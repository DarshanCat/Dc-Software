"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { notifyUsersWithPermission, createNotification } from "@/server/notifications/service";
import { requestAmendmentSchema, type RequestAmendmentInput } from "@/lib/validation/amendment";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const AMENDABLE_STATUSES = [
  "APPROVED", "DISPATCHED", "AT_VENDOR", "PARTIALLY_RETURNED", "MATERIAL_RETURNED", "SCRAP_PENDING",
];

class UserFacingError extends Error {}

export async function requestAmendment(input: RequestAmendmentInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to request DC amendments." };
    throw e;
  }

  const parsed = requestAmendmentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dc = await tx.deliveryChallan.findUnique({ where: { id: data.dcId } });
      if (!dc) throw new UserFacingError("DC not found.");
      if (!AMENDABLE_STATUSES.includes(dc.status)) {
        throw new UserFacingError(`Cannot amend a DC in status ${dc.status}.`);
      }

      const dcItem = await tx.deliveryChallanItem.findUnique({ where: { id: data.dcItemId } });
      if (!dcItem || dcItem.dcId !== data.dcId) throw new UserFacingError("Item does not belong to this DC.");

      const existingPending = await tx.dcAmendment.findFirst({
        where: { dcItemId: data.dcItemId, status: "PENDING" },
      });
      if (existingPending) {
        throw new UserFacingError("There is already a pending amendment request for this item.");
      }

      const amendment = await tx.dcAmendment.create({
        data: {
          dcId: data.dcId,
          dcItemId: data.dcItemId,
          requestedBy: user!.id,
          reason: data.reason,
          previousQuantity: dcItem.quantity,
          previousWeight: dcItem.inputWeight,
          newQuantity: data.newQuantity,
          newWeight: data.newWeight,
        },
      });

      await writeAudit(tx, {
        userId: user!.id,
        action: "AMENDMENT_REQUESTED",
        module: "DeliveryChallans",
        entityType: "DeliveryChallan",
        entityId: data.dcId,
        oldValue: { quantity: dcItem.quantity.toString(), inputWeight: dcItem.inputWeight.toString() },
        newValue: { quantity: data.newQuantity, inputWeight: data.newWeight },
        reason: data.reason,
      });

      await notifyUsersWithPermission(
        tx,
        PERMISSIONS.DC_APPROVE,
        {
          type: "DC_AMENDMENT_REQUESTED",
          title: `${dc.dcNumber} has a pending amendment request`,
          body: data.reason,
          entityType: "DeliveryChallan",
          entityId: data.dcId,
        },
        user!.id,
      );

      return amendment.id;
    });

    revalidatePath(`/dcs/${data.dcId}`);
    return { ok: true, id: result };
  } catch (e) {
    if (e instanceof UserFacingError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function approveAmendment(amendmentId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_APPROVE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to approve amendments." };
    throw e;
  }

  try {
    const dcId = await prisma.$transaction(async (tx) => {
      const amendment = await tx.dcAmendment.findUnique({ where: { id: amendmentId } });
      if (!amendment) throw new UserFacingError("Amendment not found.");
      if (amendment.status !== "PENDING") throw new UserFacingError(`This amendment is already ${amendment.status.toLowerCase()}.`);

      const dcItem = await tx.deliveryChallanItem.findUnique({ where: { id: amendment.dcItemId } });
      if (!dcItem) throw new UserFacingError("The item this amendment refers to no longer exists.");

      const alreadyReceived = await tx.materialReceiptItem.aggregate({
        where: { itemId: dcItem.itemId, receipt: { dcId: amendment.dcId } },
        _sum: { quantityReceived: true },
      });
      const receivedSoFar = Number(alreadyReceived._sum.quantityReceived ?? 0);
      if (Number(amendment.newQuantity) < receivedSoFar) {
        throw new UserFacingError(
          `Cannot approve: new quantity (${amendment.newQuantity}) is less than what's already been received (${receivedSoFar}).`,
        );
      }

      const updatedItem = await tx.deliveryChallanItem.update({
        where: { id: amendment.dcItemId },
        data: { quantity: amendment.newQuantity, inputWeight: amendment.newWeight },
      });

      await tx.dcAmendment.update({
        where: { id: amendmentId },
        data: { status: "APPROVED", decidedBy: user!.id, decidedAt: new Date() },
      });

      await writeAudit(tx, {
        userId: user!.id,
        action: "AMENDMENT_APPROVED",
        module: "DeliveryChallans",
        entityType: "DeliveryChallan",
        entityId: amendment.dcId,
        oldValue: { quantity: amendment.previousQuantity.toString(), inputWeight: amendment.previousWeight.toString() },
        newValue: { quantity: updatedItem.quantity.toString(), inputWeight: updatedItem.inputWeight.toString() },
        reason: "Amendment approved and applied",
      });

      await createNotification(tx, {
        userId: amendment.requestedBy,
        type: "DC_AMENDMENT_APPROVED",
        title: "Your amendment request was approved",
        entityType: "DeliveryChallan",
        entityId: amendment.dcId,
      });

      return amendment.dcId;
    });

    revalidatePath(`/dcs/${dcId}`);
    return { ok: true, id: amendmentId };
  } catch (e) {
    if (e instanceof UserFacingError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function rejectAmendment(amendmentId: string, reason: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_APPROVE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to reject amendments." };
    throw e;
  }

  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: "A reason is required to reject an amendment." };
  }

  try {
    const dcId = await prisma.$transaction(async (tx) => {
      const amendment = await tx.dcAmendment.findUnique({ where: { id: amendmentId } });
      if (!amendment) throw new UserFacingError("Amendment not found.");
      if (amendment.status !== "PENDING") throw new UserFacingError(`This amendment is already ${amendment.status.toLowerCase()}.`);

      await tx.dcAmendment.update({
        where: { id: amendmentId },
        data: { status: "REJECTED", decidedBy: user!.id, decidedAt: new Date(), decisionReason: reason },
      });

      await writeAudit(tx, {
        userId: user!.id,
        action: "AMENDMENT_REJECTED",
        module: "DeliveryChallans",
        entityType: "DeliveryChallan",
        entityId: amendment.dcId,
        reason,
      });

      await createNotification(tx, {
        userId: amendment.requestedBy,
        type: "DC_AMENDMENT_REJECTED",
        title: "Your amendment request was rejected",
        body: reason,
        entityType: "DeliveryChallan",
        entityId: amendment.dcId,
      });

      return amendment.dcId;
    });

    revalidatePath(`/dcs/${dcId}`);
    return { ok: true, id: amendmentId };
  } catch (e) {
    if (e instanceof UserFacingError) return { ok: false, error: e.message };
    throw e;
  }
}