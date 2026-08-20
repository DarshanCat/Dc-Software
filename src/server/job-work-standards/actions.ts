"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { jobWorkStandardSchema, type JobWorkStandardInput } from "@/lib/validation/job-work-standard";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createJobWorkStandard(input: JobWorkStandardInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.JOB_WORK_STANDARD_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to create job work standards." };
    throw e;
  }

  const parsed = jobWorkStandardSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const latest = await tx.jobWorkStandard.findFirst({
      where: { itemId: data.itemId, processId: data.processId },
      orderBy: { revision: "desc" },
    });
    const revision = (latest?.revision ?? 0) + 1;

    const standard = await tx.jobWorkStandard.create({
      data: {
        itemId: data.itemId,
        processId: data.processId,
        calculationType: data.calculationType,
        inputUOM: data.inputUOM,
        inputWeight: data.inputWeight,
        expectedOutputWeight: data.expectedOutputWeight,
        expectedScrapWeight: data.expectedScrapWeight,
        expectedScrapPercentage: data.expectedScrapPercentage ?? null,
        allowedProcessLoss: data.allowedProcessLoss,
        allowedProcessLossPercentage: data.allowedProcessLossPercentage ?? null,
        tolerancePercentage: data.tolerancePercentage,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        revision,
        approved: false,
      },
    });

    await tx.jobWorkStandardRevision.create({
      data: {
        standardId: standard.id,
        revision,
        snapshot: data,
        createdBy: user!.id,
      },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CHANGED",
      module: "JobWorkStandards",
      entityType: "JobWorkStandard",
      entityId: standard.id,
      newValue: { itemId: data.itemId, processId: data.processId, revision },
      reason: `Job Work Standard created (revision ${revision})`,
    });

    return standard.id;
  });

  revalidatePath("/masters/job-work-standards");
  return { ok: true, id: result };
}

export async function approveJobWorkStandard(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.JOB_WORK_STANDARD_APPROVE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to approve job work standards." };
    throw e;
  }

  const standard = await prisma.jobWorkStandard.findUnique({ where: { id } });
  if (!standard) return { ok: false, error: "Standard not found." };
  if (standard.approved) return { ok: false, error: "This standard is already approved." };

  await prisma.$transaction(async (tx) => {
    await tx.jobWorkStandard.update({
      where: { id },
      data: { approved: true, approvedBy: user!.id, approvedAt: new Date() },
    });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CHANGED",
      module: "JobWorkStandards",
      entityType: "JobWorkStandard",
      entityId: id,
      reason: "Job Work Standard approved",
    });
  });

  revalidatePath("/masters/job-work-standards");
  return { ok: true, id };
}