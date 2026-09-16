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

export interface CreateUOMInput {
  code: string;
  name: string;
  isWeight?: boolean;
}

export interface UpdateUOMInput extends CreateUOMInput {
  id: string;
}

export async function createUOM(input: CreateUOMInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.UOM_CREATE);
  if (!permCheck.ok) return permCheck;

  const code = (input.code || "").trim().toUpperCase();
  const name = (input.name || "").trim();

  if (!code) return { ok: false, error: "UOM Code is required." };
  if (!name) return { ok: false, error: "UOM Name is required." };

  const existing = await prisma.uOM.findFirst({ where: { code } });
  if (existing) {
    return { ok: false, error: `UOM Code '${code}' already exists.` };
  }

  const uom = await prisma.uOM.create({
    data: {
      code,
      name,
      isWeight: !!input.isWeight,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "UOM_CREATED",
    module: "MasterData",
    entityType: "UOM",
    entityId: uom.id,
    reason: `Created UOM ${uom.name} (${uom.code})`,
  });

  revalidatePath("/masters/uom");
  return { ok: true, uom };
}

export async function updateUOM(input: UpdateUOMInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.UOM_EDIT);
  if (!permCheck.ok) return permCheck;

  const code = (input.code || "").trim().toUpperCase();
  const name = (input.name || "").trim();

  if (!input.id) return { ok: false, error: "UOM ID is required." };
  if (!code) return { ok: false, error: "UOM Code is required." };
  if (!name) return { ok: false, error: "UOM Name is required." };

  const existing = await prisma.uOM.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "UOM record not found." };

  const duplicate = await prisma.uOM.findFirst({
    where: { code, NOT: { id: input.id } },
  });
  if (duplicate) {
    return { ok: false, error: `UOM Code '${code}' is used by another record.` };
  }

  const uom = await prisma.uOM.update({
    where: { id: input.id },
    data: {
      code,
      name,
      isWeight: input.isWeight ?? existing.isWeight,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "UOM_UPDATED",
    module: "MasterData",
    entityType: "UOM",
    entityId: uom.id,
    reason: `Updated UOM ${uom.name} (${uom.code})`,
  });

  revalidatePath("/masters/uom");
  return { ok: true, uom };
}

export async function deleteUOM(id: string) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.UOM_EDIT);
  if (!permCheck.ok) return permCheck;

  const existing = await prisma.uOM.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "UOM record not found." };

  const [itemCount, dcRmCount, dcFgCount] = await Promise.all([
    prisma.itemMaster.count({ where: { uom: existing.code } }),
    prisma.deliveryChallan.count({ where: { rmUom: existing.code } }),
    prisma.deliveryChallan.count({ where: { fgUom: existing.code } }),
  ]);

  if (itemCount + dcRmCount + dcFgCount > 0) {
    return {
      ok: false,
      error: "This UOM cannot be deleted because it is already used in existing Item or DC records.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.uOM.delete({ where: { id } });
    await writeAudit(tx, {
      userId: user!.id,
      action: "UOM_DELETED",
      module: "MasterData",
      entityType: "UOM",
      entityId: id,
      oldValue: { code: existing.code, name: existing.name },
      reason: "Unused UOM deleted",
    });
  });

  revalidatePath("/masters/uom");
  return { ok: true };
}
