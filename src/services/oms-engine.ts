import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * OMS Engine — Authoritative source for manufacturing stage routing, stage sequences,
 * WO target quantities, stage-wise OK completion, stage-wise rejections, and movement transactions.
 */

export interface StageDefinition {
  stageName: string;
  sequenceOrder: number;
}

export const DEFAULT_DYNAMIC_ROUTES: Record<string, StageDefinition[]> = {
  STANDARD_JOB_WORK: [
    { stageName: "F1_FOUNDRY", sequenceOrder: 1 },
    { stageName: "F2_MACHINING", sequenceOrder: 2 },
    { stageName: "F3_HEAT_TREATMENT", sequenceOrder: 3 },
    { stageName: "FI_FINAL_INSPECTION", sequenceOrder: 4 },
    { stageName: "PACKING_BSR", sequenceOrder: 5 },
    { stageName: "DISPATCH", sequenceOrder: 6 },
  ],
  DIRECT_INSPECTION: [
    { stageName: "FI_FINAL_INSPECTION", sequenceOrder: 1 },
    { stageName: "PACKING", sequenceOrder: 2 },
    { stageName: "BSR", sequenceOrder: 3 },
    { stageName: "DISPATCH", sequenceOrder: 4 },
  ],
};

export async function initializeWOStages(woNumber: string, targetQty: number, routeType: string = "STANDARD_JOB_WORK") {
  const route = DEFAULT_DYNAMIC_ROUTES[routeType] || DEFAULT_DYNAMIC_ROUTES.STANDARD_JOB_WORK;

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.productionStage.findMany({ where: { woNumber } });
    if (existing.length > 0) return existing;

    const createdStages: any[] = [];
    for (const def of route) {
      const isFirstStage = def.sequenceOrder === 1;
      const stage = await tx.productionStage.create({
        data: {
          woNumber,
          stageName: def.stageName,
          sequenceOrder: def.sequenceOrder,
          targetQty: new Prisma.Decimal(targetQty),
          completedOkQty: new Prisma.Decimal(0),
          rejectionQty: new Prisma.Decimal(0),
          scrapQty: new Prisma.Decimal(0),
          availableQty: isFirstStage ? new Prisma.Decimal(targetQty) : new Prisma.Decimal(0),
          status: isFirstStage ? "IN_PROGRESS" : "PENDING",
        },
      });
      createdStages.push(stage);
    }

    return createdStages;
  });
}

export async function recordStageProduction(
  stageId: string,
  completedOkQty: number,
  rejectionQty: number,
  userId: string
) {
  if (completedOkQty < 0 || rejectionQty < 0) {
    throw new Error("Production quantities cannot be negative.");
  }

  return await prisma.$transaction(async (tx) => {
    const stage = await tx.productionStage.findUnique({ where: { id: stageId } });
    if (!stage) throw new Error("Stage not found.");

    const currentAvailable = Number(stage.availableQty);
    const totalRequired = completedOkQty + rejectionQty;

    if (totalRequired > currentAvailable) {
      throw new Error(`Available live quantity in stage (${currentAvailable}) is insufficient for requested production (${totalRequired}).`);
    }

    const newCompleted = Number(stage.completedOkQty) + completedOkQty;
    const newRejection = Number(stage.rejectionQty) + rejectionQty;
    const newAvailable = currentAvailable - totalRequired;

    const updatedStage = await tx.productionStage.update({
      where: { id: stageId },
      data: {
        completedOkQty: new Prisma.Decimal(newCompleted),
        rejectionQty: new Prisma.Decimal(newRejection),
        availableQty: new Prisma.Decimal(newAvailable),
        status: newAvailable === 0 && newCompleted > 0 ? "COMPLETED" : "IN_PROGRESS",
      },
    });

    if (rejectionQty > 0) {
      await tx.stageRejection.create({
        data: {
          stageId,
          rejectionQty: new Prisma.Decimal(rejectionQty),
          reason: "Stage inspection rejection",
          rejectedBy: userId,
        },
      });
    }

    return updatedStage;
  });
}

export async function moveStageQuantity(
  fromStageId: string,
  toStageId: string,
  moveQty: number,
  userId: string,
  remarks?: string
) {
  if (moveQty <= 0) throw new Error("Movement quantity must be greater than zero.");

  return await prisma.$transaction(async (tx) => {
    const fromStage = await tx.productionStage.findUnique({ where: { id: fromStageId } });
    const toStage = await tx.productionStage.findUnique({ where: { id: toStageId } });

    if (!fromStage || !toStage) throw new Error("Source or destination stage not found.");

    if (fromStage.woNumber !== toStage.woNumber) {
      throw new Error("Cannot move quantity between different Work Orders.");
    }

    const completedAvailable = Number(fromStage.completedOkQty);
    if (moveQty > completedAvailable) {
      throw new Error(`Cannot move ${moveQty} NOS. Only ${completedAvailable} NOS completed OK in ${fromStage.stageName}.`);
    }

    // Deduct completed OK from source stage
    const updatedFrom = await tx.productionStage.update({
      where: { id: fromStageId },
      data: {
        completedOkQty: new Prisma.Decimal(completedAvailable - moveQty),
      },
    });

    // Add available quantity to target stage
    const updatedTo = await tx.productionStage.update({
      where: { id: toStageId },
      data: {
        availableQty: new Prisma.Decimal(Number(toStage.availableQty) + moveQty),
        status: "IN_PROGRESS",
      },
    });

    // Create movement audit ledger
    await tx.stageMovement.create({
      data: {
        stageId: fromStageId,
        fromStage: fromStage.stageName,
        toStage: toStage.stageName,
        movedQty: new Prisma.Decimal(moveQty),
        movedBy: userId,
        remarks: remarks || null,
      },
    });

    return { fromStage: updatedFrom, toStage: updatedTo };
  });
}
