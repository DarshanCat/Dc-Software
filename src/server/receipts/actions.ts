"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { calculateReconciliation } from "@/server/reconciliation/calculate";
import { materialReceiptSchema, type MaterialReceiptInput } from "@/lib/validation/receipt";

export type ActionResult =
  | { ok: true; receiptId: string; receiptNumber: string; dcStatus: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const RECEIVABLE_STATUSES = ["DISPATCHED", "AT_VENDOR", "PARTIALLY_RETURNED"] as const;

class UserFacingError extends Error {}

export async function createMaterialReceipt(input: MaterialReceiptInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.RECEIPT_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to receive material." };
    throw e;
  }

  const parsed = materialReceiptSchema.safeParse(input);
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
      await tx.$queryRaw`SELECT id FROM "DeliveryChallan" WHERE id = ${data.dcId} FOR UPDATE`;

      const dc = await tx.deliveryChallan.findUnique({
        where: { id: data.dcId },
        include: { items: true, receipts: { include: { items: true } } },
      });
      if (!dc) throw new UserFacingError("DC not found.");

      if (!RECEIVABLE_STATUSES.includes(dc.status as (typeof RECEIVABLE_STATUSES)[number])) {
        throw new UserFacingError(
          `Cannot receive material against a DC in status ${dc.status}. It must be dispatched and not already fully returned.`,
        );
      }

      const dcItemById = new Map(dc.items.map((it) => [it.itemId, it]));
      const alreadyReceivedByItem = new Map<string, number>();
      for (const receipt of dc.receipts) {
        for (const line of receipt.items) {
          alreadyReceivedByItem.set(
            line.itemId,
            (alreadyReceivedByItem.get(line.itemId) ?? 0) + Number(line.quantityReceived),
          );
        }
      }

      for (const line of data.lines) {
        const dcItem = dcItemById.get(line.itemId);
        if (!dcItem) throw new UserFacingError("One or more items do not belong to this DC.");

        // Over/under receipts are allowed: actual received may differ from what
        // was sent. Variances surface later in reconciliation as exceptions
        // instead of blocking the receipt here.
        const already = alreadyReceivedByItem.get(line.itemId) ?? 0;
        alreadyReceivedByItem.set(line.itemId, already + line.quantityReceived);
      }

      const now = new Date();
      const fy = fiscalYearOf(now);
      const receiptNumber = await nextNumber(tx, {
        key: "RCP",
        fiscalYear: fy,
        isTaken: (n) => tx.materialReceipt.findUnique({ where: { receiptNumber: n } }).then((r) => r !== null),
      });

      const receipt = await tx.materialReceipt.create({
        data: {
          receiptNumber,
          receiptDate: now,
          dcId: data.dcId,
          vendorId: dc.vendorId,
          receivedBy: user!.id,
          remarks: data.remarks || null,
          documentReference: data.documentReference || null,
          items: {
            create: data.lines.map((l) => ({
              itemId: l.itemId,
              quantityReceived: l.quantityReceived,
              weightReceived: l.weightReceived,
              rejectedQuantity: l.rejectedQuantity,
              rejectedWeight: l.rejectedWeight,
              batchNumber: l.batchNumber || null,
              heatNumber: l.heatNumber || null,
              remarks: l.remarks || null,
            })),
          },
        },
      });

      const fullyReturned = dc.items.every((it) => {
        const total = alreadyReceivedByItem.get(it.itemId) ?? 0;
        return total >= Number(it.quantity) - 1e-9;
      });
      const expectedScrapWeight = dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
      const newStatus = !fullyReturned
        ? "PARTIALLY_RETURNED"
        : expectedScrapWeight <= 0
          ? "RECONCILIATION"
          : "MATERIAL_RETURNED";

      if (newStatus !== dc.status) {
        await tx.deliveryChallan.update({ where: { id: data.dcId }, data: { status: newStatus } });
        await tx.statusHistory.create({
          data: { dcId: data.dcId, fromStatus: dc.status, toStatus: newStatus, changedBy: user!.id },
        });
      }

      if (newStatus === "RECONCILIATION") {
        await calculateReconciliation(tx, data.dcId, user!.id);
      }

      await writeAudit(tx, {
        userId: user!.id,
        action: "RECEIPT_CREATED",
        module: "MaterialReceipts",
        entityType: "MaterialReceipt",
        entityId: receipt.id,
        newValue: { receiptNumber, dcId: data.dcId, lines: data.lines },
        reason: "Material receipt recorded",
      });

      return { receiptId: receipt.id, receiptNumber, dcStatus: newStatus };
    });

    revalidatePath(`/dcs/${data.dcId}`);
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof UserFacingError) return { ok: false, error: e.message };
    throw e;
  }
}