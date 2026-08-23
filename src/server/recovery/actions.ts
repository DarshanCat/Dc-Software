"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { z } from "zod";

const recoveryReceiptSchema = z.object({
  dcId: z.string().min(1),
  recoveryTypeId: z.string().min(1, "Recovery type is required"),
  weight: z.coerce.number().positive("Weight must be > 0"),
  remarks: z.string().max(500).optional(),
});

export type RecoveryReceiptInput = z.infer<typeof recoveryReceiptSchema>;

export type ActionResult =
  | { ok: true; receiptId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Record a recovery (e.g. Boring) receipt against a DC. Supports multiple
 * receipts/lots over time (spec §12) — each call adds a new row, history
 * is preserved, nothing is overwritten.
 */
export async function createRecoveryReceipt(input: RecoveryReceiptInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    // Reuse SCRAP_CREATE as the interim permission for recovery receipts
    // (documented assumption — a dedicated RECOVERY_CREATE can be split out later).
    await requirePermission(user, PERMISSIONS.SCRAP_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to record recovery receipts." };
    throw e;
  }

  const parsed = recoveryReceiptSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: data.dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status === "CANCELLED" || dc.status === "CLOSED") {
    return { ok: false, error: `Cannot record recovery against a DC in status ${dc.status}.` };
  }

  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.recoveryReceipt.create({
      data: {
        dcId: data.dcId,
        recoveryTypeId: data.recoveryTypeId,
        receiptDate: new Date(),
        receivedBy: user!.id,
        weight: data.weight,
        remarks: data.remarks || null,
      },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "BORING_RECEIVED",
      module: "Recovery",
      entityType: "RecoveryReceipt",
      entityId: receipt.id,
      newValue: { dcId: data.dcId, recoveryTypeId: data.recoveryTypeId, weight: data.weight },
      reason: "Recovery material received",
    });

    return { receiptId: receipt.id };
  });

  revalidatePath(`/dcs/${data.dcId}`);
  revalidatePath(`/work-orders/${dc.workOrderId}`);
  return { ok: true, ...result };
}

/**
 * Declare the expected recovery (e.g. Boring KG) requirement on a DC.
 * Optional — a DC may have zero recovery requirements if boring doesn't apply.
 */
const recoveryRequirementSchema = z.object({
  dcId: z.string().min(1),
  recoveryTypeId: z.string().min(1),
  expectedWeight: z.coerce.number().positive("Expected weight must be > 0"),
});
export type RecoveryRequirementInput = z.infer<typeof recoveryRequirementSchema>;

export async function setRecoveryRequirement(input: RecoveryRequirementInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_CREATE);
  } catch {
    return { ok: false, error: "Not permitted." };
  }

  const parsed = recoveryRequirementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields." };
  const data = parsed.data;

  const req = await prisma.recoveryRequirement.upsert({
    where: { dcId_recoveryTypeId: { dcId: data.dcId, recoveryTypeId: data.recoveryTypeId } },
    create: { dcId: data.dcId, recoveryTypeId: data.recoveryTypeId, expectedWeight: data.expectedWeight },
    update: { expectedWeight: data.expectedWeight },
  });

  revalidatePath(`/dcs/${data.dcId}`);
  return { ok: true, receiptId: req.id };
}