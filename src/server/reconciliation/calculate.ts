import { prisma } from "@/lib/db";
import { reconcile } from "@/services/reconciliation.service";
import type { ExceptionType } from "@prisma/client";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function describeException(code: string, result: ReturnType<typeof reconcile>): string {
  switch (code) {
    case "MATERIAL_SHORTAGE":
      return `Finished weight returned (${result.breakdown.finishedWeight} kg) is less than expected (${result.breakdown.accountedWeight} kg).`;
    case "SCRAP_SHORTAGE":
      return `Scrap returned (${result.breakdown.scrapWeight} kg) is less than expected (${result.breakdown.scrapOutstanding} kg outstanding).`;
    case "EXCESS_SCRAP":
      return `Scrap returned (${result.breakdown.scrapWeight} kg) exceeds allowed tolerance.`;
    case "PROCESS_LOSS_EXCEEDED":
      return `Unaccounted process loss (${result.breakdown.unaccountedWeight} kg) exceeds allowed threshold (${result.breakdown.approvedProcessLoss} kg).`;
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
      receipts: { include: { items: true } },
      scrapReceipts: { include: { items: true } },
    },
  });
  if (!dc) throw new Error("DC not found during reconciliation calculation.");

  const totalInputWeight = Number(dc.rmQuantity ?? 0);
  const expectedFinishedWeight = Number(dc.returnFgQuantity ?? 0);
  const expectedScrapWeight = Number(dc.expectedScrap ?? 0);
  const approvedProcessLoss = 0;
  const tolerancePercentage = 0;

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
      totalInputWeight: result.breakdown.inputWeight,
      totalFinishedWeight: result.breakdown.finishedWeight,
      totalScrapWeight: result.breakdown.scrapWeight,
      totalRejectedWeight: result.breakdown.rejectedWeight,
      approvedProcessLoss: result.breakdown.approvedProcessLoss,
      accountedWeight: result.breakdown.accountedWeight,
      unaccountedWeight: result.breakdown.unaccountedWeight,
      scrapRecoveryPercent: result.breakdown.scrapRecoveryPercent ? Number(result.breakdown.scrapRecoveryPercent) : null,
      closedAt: result.eligibleForClosure ? new Date() : null,
      closedBy: result.eligibleForClosure ? userId : null,
    },
    update: {
      status: result.status,
      totalInputWeight: result.breakdown.inputWeight,
      totalFinishedWeight: result.breakdown.finishedWeight,
      totalScrapWeight: result.breakdown.scrapWeight,
      totalRejectedWeight: result.breakdown.rejectedWeight,
      approvedProcessLoss: result.breakdown.approvedProcessLoss,
      accountedWeight: result.breakdown.accountedWeight,
      unaccountedWeight: result.breakdown.unaccountedWeight,
      scrapRecoveryPercent: result.breakdown.scrapRecoveryPercent ? Number(result.breakdown.scrapRecoveryPercent) : null,
    },
  });

  await tx.exception.deleteMany({ where: { dcId } });

  if (result.exceptionTypes.length > 0) {
    for (const code of result.exceptionTypes) {
      await tx.exception.create({
        data: {
          dcId,
          type: code as ExceptionType,
          description: describeException(code, result),
        },
      });
    }
  }

  return { reconciliation, result };
}