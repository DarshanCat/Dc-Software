"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";

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

export interface CreateDepartmentInput {
  code: string;
  name: string;
}

export interface UpdateDepartmentInput extends CreateDepartmentInput {
  id: string;
  active?: boolean;
}

export async function getDepartments(includeInactive = true) {
  return prisma.department.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(input: CreateDepartmentInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SYSTEM_SETTINGS);
  if (!permCheck.ok) return permCheck;

  const code = (input.code || "").trim().toUpperCase();
  const name = (input.name || "").trim();

  if (!code) return { ok: false, error: "Department Code is required." };
  if (!name) return { ok: false, error: "Department Name is required." };

  const existing = await prisma.department.findFirst({ where: { code } });
  if (existing) {
    return { ok: false, error: `Department Code '${code}' already exists.` };
  }

  const dept = await prisma.department.create({
    data: {
      code,
      name,
      active: true,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "DEPARTMENT_CREATED",
    module: "MasterData",
    entityType: "Department",
    entityId: dept.id,
    reason: `Created Department ${dept.name} (${dept.code})`,
  });

  revalidatePath("/masters/departments");
  revalidatePath("/dcs/new");
  return { ok: true, department: dept };
}

export async function updateDepartment(input: UpdateDepartmentInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SYSTEM_SETTINGS);
  if (!permCheck.ok) return permCheck;

  const code = (input.code || "").trim().toUpperCase();
  const name = (input.name || "").trim();

  if (!input.id) return { ok: false, error: "Department ID is required." };
  if (!code) return { ok: false, error: "Department Code is required." };
  if (!name) return { ok: false, error: "Department Name is required." };

  const existing = await prisma.department.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "Department record not found." };

  const duplicate = await prisma.department.findFirst({
    where: { code, NOT: { id: input.id } },
  });
  if (duplicate) {
    return { ok: false, error: `Department Code '${code}' is used by another record.` };
  }

  const dept = await prisma.department.update({
    where: { id: input.id },
    data: {
      code,
      name,
      active: input.active ?? existing.active,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "DEPARTMENT_UPDATED",
    module: "MasterData",
    entityType: "Department",
    entityId: dept.id,
    reason: `Updated Department ${dept.name} (${dept.code})`,
  });

  revalidatePath("/masters/departments");
  revalidatePath("/dcs/new");
  return { ok: true, department: dept };
}

export async function toggleDepartmentStatus(id: string) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SYSTEM_SETTINGS);
  if (!permCheck.ok) return permCheck;

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Department record not found." };

  const dept = await prisma.department.update({
    where: { id },
    data: { active: !existing.active },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "DEPARTMENT_STATUS_TOGGLED",
    module: "MasterData",
    entityType: "Department",
    entityId: dept.id,
    reason: `Department ${dept.code} active set to ${dept.active}`,
  });

  revalidatePath("/masters/departments");
  revalidatePath("/dcs/new");
  return { ok: true, active: dept.active };
}
