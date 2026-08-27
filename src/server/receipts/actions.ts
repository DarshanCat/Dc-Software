"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, assertVendorScope, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { notifyUsersWithPermission } from "@/server/notifications/service";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { z } from "zod";

const receiptLineSchema = z.object({
  quantityReceived: z.coerce.number().min(0, "Quantity cannot be negative"),
  weightReceived: z.coerce.number().min(0, "Weight cannot be negative"),
  rejectedQuantity: z.coerce.number().min(0).default(0),
  rejectedWeight: z.coerce.number().min(0).default(0),
  batchNumber: z.string().optional(),
  heatNumber: z.string().optional(),
  remarks: z.string().optional(),
});

const createReceiptSchema = z.object({
  dcId: z.string().min(1, "DC is required"),
  documentReference: z.string().optional(),
  remarks: z.string().optional(),
  lines: z.array(receiptLineSchema).min(1, "At least one line is required"),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type ActionResult = { ok: true; receiptId: string } | { ok: false; error: string };

const RECEIVABLE_STATUSES = ["DISPATCHED", "AT_VENDOR", "PARTIALLY_RETURNED"] as const;

export async function createReceipt(input: CreateReceiptInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.RECEIPT_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to create receipts." };
    throw e;
  }

  const parsed = createReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DeliveryChallan" WHERE id = ${data.dcId} FOR UPDATE`;

      const dc = await tx.deliveryChallan.findUnique({
        where: { id: data.dcId },
        include: { receipts: { include: { items: true } } },
      });
      if (!dc) throw new Error("DC not found.");
      assertVendorScope(user!, dc.vendorId);

      if (!RECEIVABLE_STATUSES.includes(dc.status as (typeof RECEIVABLE_STATUSES)[number])) {
        throw new Error(
          `Cannot receive material against a DC in status ${dc.status}. It must be dispatched and not already fully returned.`,
        );
      }

      let alreadyReceivedQty = 0;
      for (const receipt of dc.receipts) {
        for (const line of receipt.items) {
          alreadyReceivedQty += Number(line.quantityReceived);
        }
      }

      const newLinesQty = data.lines.reduce((s, l) => s + l.quantityReceived, 0);
      const totalReceivedQty = alreadyReceivedQty + newLinesQty;

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

      const targetReturnQty = Number(dc.returnFgQuantity ?? 0);
      const fullyReturned = totalReceivedQty >= targetReturnQty - 1e-9;
      const expectedScrapWeight = Number(dc.expectedScrap ?? 0);
      const newStatus = !fullyReturned
        ? "PARTIALLY_RETURNED"
        : expectedScrapWeight <= 0
          ? "RECONCILIATION"
          : "MATERIAL_RETURNED";

      if (newStatus !== dc.status) {
        await tx.deliveryChallan.update({ where: { id: data.dcId }, data: { status: newStatus } });
        await tx.statusHistory.create({
          data: {
            dcId: data.dcId,
            fromStatus: dc.status,
            toStatus: newStatus,
            changedBy: user!.id,
            reason: `Receipt created (${receiptNumber})`,
          },
        });
      }

      await writeAudit(tx, {
        userId: user!.id,
        action: "RECEIPT_CREATED",
        module: "Receipts",
        entityType: "MaterialReceipt",
        entityId: receipt.id,
        newValue: { receiptNumber, linesCount: data.lines.length },
        reason: "Material receipt recorded",
      });

      await notifyUsersWithPermission(
        tx,
        PERMISSIONS.DC_VIEW,
        {
          type: "MATERIAL_RECEIVED",
          title: `Material received for ${dc.dcNumber}`,
          body: `Receipt ${receiptNumber} recorded for ${dc.dcNumber}`,
          entityType: "DeliveryChallan",
          entityId: data.dcId,
          targetUrl: `/dcs/${data.dcId}`,
        },
        user!.id,
      );

      return receipt.id;
    });

    revalidatePath(`/dcs/${data.dcId}`);
    revalidatePath("/receipts");
    return { ok: true, receiptId: result };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Failed to create receipt." };
  }
}