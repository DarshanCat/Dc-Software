"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, assertVendorScope, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { calculateReconciliation } from "@/server/reconciliation/calculate";

export type ActionResult = { ok: true } | { ok: false; error: string };

const BLOCKING_EXCEPTION_STATUSES = ["OPEN", "UNDER_REVIEW", "REJECTED"] as const;

export async function closeReconciliationDc(dcId: string, closureReason?: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.RECONCILIATION_CLOSE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to close a DC." };
    throw e;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const dc = await tx.deliveryChallan.findUnique({
        where: { id: dcId },
        include: { reconciliation: true },
      });
      if (!dc) throw new Error("DC not found.");
      assertVendorScope(user!, dc.vendorId);
      if (dc.status !== "RECONCILIATION") {
        throw new Error(`Only a DC in RECONCILIATION can be closed (current: ${dc.status}).`);
      }
      if (!dc.reconciliation) {
        throw new Error("Reconciliation has not been calculated for this DC yet.");
      }

      const openExceptions = await tx.exception.findMany({
        where: { dcId, status: { in: [...BLOCKING_EXCEPTION_STATUSES] } },
      });
      if (openExceptions.length > 0) {
        throw new Error(
          `Cannot close: ${openExceptions.length} unresolved exception(s) remain. Approve each one first.`,
        );
      }

      const now = new Date();
      await tx.reconciliation.update({
        where: { dcId },
        data: { status: "CLOSED", closedAt: now, closedBy: user!.id, closureReason: closureReason || null },
      });
      await tx.deliveryChallan.update({ where: { id: dcId }, data: { status: "CLOSED" } });
      await tx.statusHistory.create({
        data: { dcId, fromStatus: dc.status, toStatus: "CLOSED", changedBy: user!.id, reason: closureReason },
      });
      await writeAudit(tx, {
        userId: user!.id,
        action: "DC_CLOSED",
        module: "DeliveryChallans",
        entityType: "DeliveryChallan",
        entityId: dcId,
        reason: closureReason || "DC closed",
      });
    });

    revalidatePath(`/dcs/${dcId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Failed to close DC." };
  }
}

export async function approveException(exceptionId: string, reason: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.RECONCILIATION_OVERRIDE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to approve exceptions." };
    throw e;
  }

  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: "A reason is required to approve an exception." };
  }

  try {
    const dcId = await prisma.$transaction(async (tx) => {
      const exception = await tx.exception.findUnique({ where: { id: exceptionId } });
      if (!exception) throw new Error("Exception not found.");
      if (!BLOCKING_EXCEPTION_STATUSES.includes(exception.status as (typeof BLOCKING_EXCEPTION_STATUSES)[number])) {
        throw new Error(`This exception is already ${exception.status.toLowerCase()}.`);
      }

      await tx.exceptionApproval.create({
        data: { exceptionId, approvedBy: user!.id, reason, approved: true },
      });
      await tx.exception.update({
        where: { id: exceptionId },
        data: {
          status: "APPROVED",
          resolution: reason,
          resolvedBy: user!.id,
          resolvedAt: new Date(),
        },
      });

      await writeAudit(tx, {
        userId: user!.id,
        action: "EXCEPTION_RESOLVED",
        module: "Reconciliation",
        entityType: "Exception",
        entityId: exceptionId,
        newValue: { reason },
        reason: "Exception approved as override",
      });

      return exception.dcId;
    });

    revalidatePath(`/dcs/${dcId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Failed to approve exception." };
  }
}

export async function recalculateReconciliation(dcId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.RECONCILIATION_OVERRIDE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to recalculate reconciliation." };
    throw e;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const dc = await tx.deliveryChallan.findUnique({ where: { id: dcId } });
      if (!dc) throw new Error("DC not found.");
      if (dc.status !== "RECONCILIATION") {
        throw new Error(`Can only recalculate a DC in RECONCILIATION (current: ${dc.status}).`);
      }
      await calculateReconciliation(tx, dcId, user!.id);
    });

    revalidatePath(`/dcs/${dcId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Failed to recalculate reconciliation." };
  }
}