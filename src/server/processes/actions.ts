"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { z } from "zod";

const processSchema = z.object({
  code: z.string().trim().min(1, "Process code is required.").max(50),
  name: z.string().trim().min(1, "Process name is required.").max(100),
});

export type ProcessInput = z.infer<typeof processSchema>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createProcess(input: ProcessInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.PROCESS_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to create processes." };
    throw e;
  }

  const parsed = processSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.process.findUnique({ where: { code: data.code } });
  if (existing) {
    return { ok: false, error: "Process code already exists.", fieldErrors: { code: "Already in use." } };
  }

  await prisma.$transaction(async (tx) => {
    const processRec = await tx.process.create({
      data: { code: data.code, name: data.name, active: true },
    });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CREATED",
      module: "Processes",
      entityType: "Process",
      entityId: processRec.id,
      newValue: { code: processRec.code, name: processRec.name },
      reason: "Process created",
    });
  });

  revalidatePath("/masters/processes");
  return { ok: true };
}

export async function updateProcess(id: string, input: ProcessInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.PROCESS_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to edit processes." };
    throw e;
  }

  const parsed = processSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.process.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Process not found." };

  if (data.code !== existing.code) {
    const duplicate = await prisma.process.findUnique({ where: { code: data.code } });
    if (duplicate) return { ok: false, error: "Process code already exists." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.process.update({
      where: { id },
      data: { code: data.code, name: data.name },
    });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_UPDATED",
      module: "Processes",
      entityType: "Process",
      entityId: id,
      oldValue: { code: existing.code, name: existing.name },
      newValue: { code: updated.code, name: updated.name },
      reason: "Process updated",
    });
  });

  revalidatePath("/masters/processes");
  return { ok: true };
}

export async function toggleProcessActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.PROCESS_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to modify processes." };
    throw e;
  }

  const existing = await prisma.process.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Process not found." };

  await prisma.$transaction(async (tx) => {
    await tx.process.update({ where: { id }, data: { active } });
    await writeAudit(tx, {
      userId: user!.id,
      action: active ? "MASTER_REACTIVATED" : "MASTER_DEACTIVATED",
      module: "Processes",
      entityType: "Process",
      entityId: id,
      oldValue: { active: existing.active },
      newValue: { active },
      reason: active ? "Process reactivated" : "Process deactivated",
    });
  });

  revalidatePath("/masters/processes");
  return { ok: true };
}

export async function deleteProcess(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.PROCESS_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to delete processes." };
    throw e;
  }

  const existing = await prisma.process.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Process not found." };

  // Check foreign key dependencies
  const [dcCount, woCount] = await Promise.all([
    prisma.deliveryChallan.count({ where: { processId: id } }),
    prisma.workOrder.count({ where: { processId: id } }),
  ]);

  if (dcCount + woCount > 0) {
    return {
      ok: false,
      error: "This process cannot be deleted because it is already used in existing DC records. Deactivate it instead.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.process.delete({ where: { id } });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_DELETED",
      module: "Processes",
      entityType: "Process",
      entityId: id,
      oldValue: { code: existing.code, name: existing.name },
      reason: "Unused process deleted",
    });
  });

  revalidatePath("/masters/processes");
  return { ok: true };
}
