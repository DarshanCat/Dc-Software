import type { Prisma, ExceptionType } from "@prisma/client";
import { reconcile, type ReconciliationResult } from "@/services/reconciliation.service";
import { writeAudit } from "@/server/audit";
import { notifyUsersWithPermission } from "@/server/notifications/service";
import { PERMISSIONS } from "@/config/permissions";

type Tx = Prisma.TransactionClient;

function exceptionDescription(type: string, result: ReconciliationResult): string {
  switch (type) {
    case "MATERIAL_SHORTAGE":
      return `Finished material received (${result.breakdown.finishedWeight} kg) is less than expected (${result.breakdown.unaccountedWeight} kg unaccounted).`;
    case "SCRAP_SHORTAGE":
      return `Scrap received (${result.breakdown.scrapWeight} kg) is below the tolerance band.`;
    case "EXCESS_SCRAP":
      return `Scrap received (${result.breakdown.scrapWeight} kg) is above the tolerance band — flagged for review, not assumed bad.`;
    case "PROCESS_LOSS_EXCEEDED":
      return `Unaccounted weight (${result.breakdown.unaccountedWeight} kg) exceeds the allowed tolerance.`;
    case "WEIGHT_MISMATCH":
      return `Unaccounted weight (${result.breakdown.unaccountedWeight} kg) is outside the configured tolerance.`;
    default:
      return "Reconciliation exception.";
  }
}

export async function calculateReconciliation(tx: Tx, dcId: string, userId: string | null) {
  const dc = await tx.deliveryChallan.findUnique({
    where: { id: dcId },
    include: {
      items: true,
      receipts: { include: { items: true } },
      scrapReceipts: { include: { items: true } },
    },
  });
  if (!dc) throw new Error("DC not found during reconciliation calculation.");

  const totalInputWeight = dc.items.reduce((s, it) => s + Number(it.inputWeight), 0);
  const expectedFinishedWeight = dc.items.reduce((s, it) => s + Number(it.expectedFinishedWeight), 0);
  const expectedScrapWeight = dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
  const approvedProcessLoss = dc.items.reduce((s, it) => s + Number(it.expectedProcessLoss), 0);
  const tolerancePercentage = dc.items.length > 0 ? Number(dc.items[0].tolerancePercentage) : 0;

  const totalFinishedWeight = dc.receipts.reduce(
    (sum, r) => sum + r.items.reduce((s, l) => s + (Number(l.weightReceived) - Number(l.rejectedWeight)), 0),
    0,
  );
  const totalRejectedWeight = dc.receipts.reduce(
    (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.rejectedWeight), 0),
    0,
  );
  const totalScrapWeight = dc.scrapReceipts.reduce(
    (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
    0,
  );

  const result = reconcile({
    inputWeight: totalInputWeight,
    finishedWeight: totalFinishedWeight,
    scrapWeight: totalScrapWeight,
    rejectedWeight: totalRejectedWeight,
    approvedProcessLoss,
    expectedFinishedWeight,
    expectedScrapWeight,
    unaccountedTolerancePercentage: tolerancePercentage,
  });

  const reconciliation = await tx.reconciliation.upsert({
    where: { dcId },
    create: {
      dcId,
      status: result.status,
      totalInputWeight,
      totalFinishedWeight,
      totalScrapWeight,
      totalRejectedWeight,
      approvedProcessLoss,
      accountedWeight: result.breakdown.accountedWeight,
      unaccountedWeight: result.breakdown.unaccountedWeight,
      scrapRecoveryPercent: result.breakdown.scrapRecoveryPercent,
      calculatedBy: userId,
    },
    update: {
      status: result.status,
      totalInputWeight,
      totalFinishedWeight,
      totalScrapWeight,
      totalRejectedWeight,
      approvedProcessLoss,
      accountedWeight: result.breakdown.accountedWeight,
      unaccountedWeight: result.breakdown.unaccountedWeight,
      scrapRecoveryPercent: result.breakdown.scrapRecoveryPercent,
      calculatedAt: new Date(),
      calculatedBy: userId,
    },
  });

  const existingOpen = await tx.exception.findMany({ where: { dcId, status: "OPEN" }, select: { type: true } });
  const existingOpenTypes = new Set(existingOpen.map((e) => e.type as string));

  for (const type of result.exceptionTypes) {
    if (existingOpenTypes.has(type)) continue;
    await tx.exception.create({
      data: {
        dcId,
        type: type as ExceptionType,
        severity: "MEDIUM",
        description: exceptionDescription(type, result),
        variance: result.breakdown.unaccountedWeight,
        status: "OPEN",
        createdBy: userId,
      },
    });
  }

    await writeAudit(tx, {
    userId,
    action: "RECONCILIATION_CALCULATED",
    module: "Reconciliation",
    entityType: "Reconciliation",
    entityId: reconciliation.id,
    newValue: {
      status: result.status,
      unaccountedWeight: result.breakdown.unaccountedWeight,
      exceptionTypes: result.exceptionTypes,
    },
    reason: "Reconciliation calculated",
  });

  if (result.status === "EXCEPTION") {
    await notifyUsersWithPermission(tx, PERMISSIONS.RECONCILIATION_OVERRIDE, {
      type: "RECONCILIATION_EXCEPTION",
      title: `${dc.dcNumber} has a reconciliation exception`,
      body: `Unaccounted weight: ${result.breakdown.unaccountedWeight} kg. Review and approve or investigate.`,
      entityType: "DeliveryChallan",
      entityId: dcId,
    });
  }

  return { reconciliation, result };
}