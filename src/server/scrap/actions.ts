"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, assertVendorScope, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { evaluateScrap } from "@/services/scrap.service";
import { calculateReconciliation } from "@/server/reconciliation/calculate";
import { getToleranceSettings } from "@/server/settings/tolerances";
import { scrapReceiptSchema, type ScrapReceiptInput } from "@/lib/validation/scrap-receipt";

export type ActionResult =
  | { ok: true; scrapReceiptId: string; scrapReceiptNumber: string; dcStatus: string; scrapStatus: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const SCRAP_RECEIVABLE_STATUSES = ["MATERIAL_RETURNED", "SCRAP_PENDING"] as const;

export async function createScrapReceipt(input: ScrapReceiptInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.SCRAP_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to receive scrap." };
    throw e;
  }

  const parsed = scrapReceiptSchema.safeParse(input);
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
        include: { scrapReceipts: { include: { items: true } } },
      });
      if (!dc) throw new Error("DC not found.");
      assertVendorScope(user!, dc.vendorId);

      if (!SCRAP_RECEIVABLE_STATUSES.includes(dc.status as (typeof SCRAP_RECEIVABLE_STATUSES)[number])) {
        throw new Error(
          `Cannot receive scrap against a DC in status ${dc.status}. Finished material must be fully returned first.`,
        );
      }

      const tolerances = await getToleranceSettings(tx as never);
      const expectedScrapWeight = Number(dc.expectedScrap ?? 0);
      const tolerancePercentage = tolerances.scrapTolerancePercentage;

      const alreadyReceived = dc.scrapReceipts.reduce(
        (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
        0,
      );
      const newLinesWeight = data.lines.reduce((sum, l) => sum + l.weight, 0);
      const totalReceived = alreadyReceived + newLinesWeight;

      const evaluation = evaluateScrap(expectedScrapWeight, totalReceived, tolerancePercentage);

      const now = new Date();
      const fy = fiscalYearOf(now);
      const scrapReceiptNumber = await nextNumber(tx, {
        key: "SCR",
        fiscalYear: fy,
        isTaken: (n) => tx.scrapReceipt.findUnique({ where: { scrapReceiptNumber: n } }).then((r) => r !== null),
      });

      const scrapReceipt = await tx.scrapReceipt.create({
        data: {
          scrapReceiptNumber,
          dcId: data.dcId,
          vendorId: dc.vendorId,
          receiptDate: now,
          receivedBy: user!.id,
          weighmentSlipNumber: data.weighmentSlipNumber || null,
          remarks: data.remarks || null,
          items: {
            create: data.lines.map((l) => ({
              scrapTypeId: l.scrapTypeId,
              weight: l.weight,
              quantity: l.quantity ?? null,
              uom: l.uom,
              batchReference: l.batchReference || null,
              documentReference: l.documentReference || null,
              remarks: l.remarks || null,
            })),
          },
        },
      });

      const newStatus = evaluation.status === "SCRAP_SHORT" ? "SCRAP_PENDING" : "RECONCILIATION";

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
        action: "SCRAP_RECEIVED",
        module: "ScrapReceipts",
        entityType: "ScrapReceipt",
        entityId: scrapReceipt.id,
        newValue: { scrapReceiptNumber, dcId: data.dcId, lines: data.lines, scrapStatus: evaluation.status },
        reason: "Scrap receipt recorded",
      });

      return {
        scrapReceiptId: scrapReceipt.id,
        scrapReceiptNumber,
        dcStatus: newStatus,
        scrapStatus: evaluation.status,
      };
    });

    revalidatePath(`/dcs/${data.dcId}`);
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Failed to create scrap receipt." };
  }
}