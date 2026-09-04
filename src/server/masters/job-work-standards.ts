"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { Prisma } from "@prisma/client";

async function checkPermission(user: any, permission: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!user) return { ok: false, error: "Not signed in." };
  try {
    await requirePermission(user, permission);
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to perform this action." };
    return { ok: false, error: e instanceof Error ? e.message : "Permission denied." };
  }
}

export interface CreateJobWorkStandardInput {
  processId: string;
  partNumber: string;
  standardLossPercentage?: number;
  turnaroundDays?: number;
  ratePerQuantity?: number;
}

export interface UpdateJobWorkStandardInput extends CreateJobWorkStandardInput {
  id: string;
  active?: boolean;
}

function serializeJobWorkStandard(std: any) {
  if (!std) return null;
  return {
    id: std.id,
    processId: std.processId,
    processName: std.process?.name || "",
    partNumber: std.partNumber,
    standardLossPercentage: std.standardLossPercentage != null ? Number(std.standardLossPercentage) : 0,
    turnaroundDays: std.turnaroundDays,
    ratePerQuantity: std.ratePerQuantity != null ? Number(std.ratePerQuantity) : null,
    active: std.active,
    createdAt: std.createdAt ? std.createdAt.toISOString() : null,
    updatedAt: std.updatedAt ? std.updatedAt.toISOString() : null,
  };
}

export async function getJobWorkStandards() {
  const standards = await prisma.jobWorkStandard.findMany({
    include: { process: true },
    orderBy: { createdAt: "desc" },
  });
  return standards.map(serializeJobWorkStandard);
}

export async function createJobWorkStandard(input: CreateJobWorkStandardInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.JOB_WORK_STANDARD_CREATE);
  if (!permCheck.ok) return permCheck;

  const partNum = (input.partNumber || "").trim();
  if (!input.processId) return { ok: false, error: "Process is required." };
  if (!partNum) return { ok: false, error: "Part Number is required." };

  const processRec = await prisma.process.findUnique({ where: { id: input.processId } });
  if (!processRec) return { ok: false, error: "Selected process was not found." };

  const loss = input.standardLossPercentage != null && !isNaN(Number(input.standardLossPercentage)) ? Number(input.standardLossPercentage) : 0;
  const days = input.turnaroundDays != null && !isNaN(Number(input.turnaroundDays)) ? Number(input.turnaroundDays) : 15;
  const rate = input.ratePerQuantity != null && !isNaN(Number(input.ratePerQuantity)) ? Number(input.ratePerQuantity) : null;

  const std = await prisma.jobWorkStandard.create({
    data: {
      processId: input.processId,
      partNumber: partNum,
      standardLossPercentage: new Prisma.Decimal(loss),
      turnaroundDays: days,
      ratePerQuantity: rate != null ? new Prisma.Decimal(rate) : null,
      active: true,
    },
    include: { process: true },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "JOB_WORK_STANDARD_CREATED",
    module: "MasterData",
    entityType: "JobWorkStandard",
    entityId: std.id,
    reason: `Created Job Work Standard for Part ${std.partNumber} / Process ${processRec.name}`,
  });

  revalidatePath("/masters/job-work-standards");
  return { ok: true, standard: serializeJobWorkStandard(std) };
}

export async function updateJobWorkStandard(input: UpdateJobWorkStandardInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.JOB_WORK_STANDARD_CREATE);
  if (!permCheck.ok) return permCheck;

  const partNum = (input.partNumber || "").trim();
  if (!input.id) return { ok: false, error: "Standard ID is required." };
  if (!input.processId) return { ok: false, error: "Process is required." };
  if (!partNum) return { ok: false, error: "Part Number is required." };

  const existing = await prisma.jobWorkStandard.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "Job Work Standard record not found." };

  const loss = input.standardLossPercentage != null && !isNaN(Number(input.standardLossPercentage)) ? Number(input.standardLossPercentage) : 0;
  const days = input.turnaroundDays != null && !isNaN(Number(input.turnaroundDays)) ? Number(input.turnaroundDays) : 15;
  const rate = input.ratePerQuantity != null && !isNaN(Number(input.ratePerQuantity)) ? Number(input.ratePerQuantity) : null;

  const std = await prisma.jobWorkStandard.update({
    where: { id: input.id },
    data: {
      processId: input.processId,
      partNumber: partNum,
      standardLossPercentage: new Prisma.Decimal(loss),
      turnaroundDays: days,
      ratePerQuantity: rate != null ? new Prisma.Decimal(rate) : null,
      active: input.active ?? existing.active,
    },
    include: { process: true },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "JOB_WORK_STANDARD_UPDATED",
    module: "MasterData",
    entityType: "JobWorkStandard",
    entityId: std.id,
    reason: `Updated Job Work Standard ${std.id}`,
  });

  revalidatePath("/masters/job-work-standards");
  return { ok: true, standard: serializeJobWorkStandard(std) };
}

export async function toggleJobWorkStandardStatus(id: string) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.JOB_WORK_STANDARD_CREATE);
  if (!permCheck.ok) return permCheck;

  const existing = await prisma.jobWorkStandard.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Job Work Standard record not found." };

  const std = await prisma.jobWorkStandard.update({
    where: { id },
    data: { active: !existing.active },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "JOB_WORK_STANDARD_STATUS_TOGGLED",
    module: "MasterData",
    entityType: "JobWorkStandard",
    entityId: std.id,
    reason: `Job Work Standard active set to ${std.active}`,
  });

  revalidatePath("/masters/job-work-standards");
  return { ok: true, active: std.active };
}
