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

export interface CreateScrapTypeInput {
  code: string;
  name: string;
  description?: string;
  unit?: string;
}

export interface UpdateScrapTypeInput extends CreateScrapTypeInput {
  id: string;
  active?: boolean;
}

export async function createScrapType(input: CreateScrapTypeInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SCRAP_CREATE);
  if (!permCheck.ok) return permCheck;

  const code = (input.code || "").trim().toUpperCase();
  const name = (input.name || "").trim();

  if (!code) return { ok: false, error: "Scrap Type Code is required." };
  if (!name) return { ok: false, error: "Scrap Type Name is required." };

  const existing = await prisma.scrapType.findFirst({ where: { code } });
  if (existing) {
    return { ok: false, error: `Scrap Type Code '${code}' already exists.` };
  }

  const scrapType = await prisma.scrapType.create({
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      unit: input.unit?.trim() || "KG",
      active: true,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "SCRAP_TYPE_CREATED",
    module: "MasterData",
    entityType: "ScrapType",
    entityId: scrapType.id,
    reason: `Created Scrap Type ${scrapType.name} (${scrapType.code})`,
  });

  revalidatePath("/masters/scrap-types");
  return { ok: true, scrapType };
}

export async function updateScrapType(input: UpdateScrapTypeInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SCRAP_EDIT);
  if (!permCheck.ok) return permCheck;

  const code = (input.code || "").trim().toUpperCase();
  const name = (input.name || "").trim();

  if (!input.id) return { ok: false, error: "Scrap Type ID is required." };
  if (!code) return { ok: false, error: "Scrap Type Code is required." };
  if (!name) return { ok: false, error: "Scrap Type Name is required." };

  const existing = await prisma.scrapType.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "Scrap Type record not found." };

  const duplicate = await prisma.scrapType.findFirst({
    where: { code, NOT: { id: input.id } },
  });
  if (duplicate) {
    return { ok: false, error: `Scrap Type Code '${code}' is used by another record.` };
  }

  const scrapType = await prisma.scrapType.update({
    where: { id: input.id },
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      unit: input.unit?.trim() || existing.unit,
      active: input.active ?? existing.active,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "SCRAP_TYPE_UPDATED",
    module: "MasterData",
    entityType: "ScrapType",
    entityId: scrapType.id,
    reason: `Updated Scrap Type ${scrapType.name} (${scrapType.code})`,
  });

  revalidatePath("/masters/scrap-types");
  return { ok: true, scrapType };
}

export async function toggleScrapTypeStatus(id: string) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SCRAP_EDIT);
  if (!permCheck.ok) return permCheck;

  const existing = await prisma.scrapType.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Scrap Type record not found." };

  const scrapType = await prisma.scrapType.update({
    where: { id },
    data: { active: !existing.active },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "SCRAP_TYPE_STATUS_TOGGLED",
    module: "MasterData",
    entityType: "ScrapType",
    entityId: scrapType.id,
    reason: `Scrap Type ${scrapType.code} active set to ${scrapType.active}`,
  });

  revalidatePath("/masters/scrap-types");
  return { ok: true, active: scrapType.active };
}

export async function deleteScrapType(id: string) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SCRAP_EDIT);
  if (!permCheck.ok) return permCheck;

  const existing = await prisma.scrapType.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Scrap Type record not found." };

  const [receiptCount, classCount] = await Promise.all([
    prisma.scrapReceiptItem.count({ where: { scrapTypeId: id } }),
    prisma.materialClassificationItem.count({ where: { scrapTypeId: id } }),
  ]);

  if (receiptCount + classCount > 0) {
    return {
      ok: false,
      error: "This Scrap Type cannot be deleted because it is already used in existing scrap receipts or classification records. Deactivate it instead.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.scrapType.delete({ where: { id } });
    await writeAudit(tx, {
      userId: user!.id,
      action: "SCRAP_TYPE_DELETED",
      module: "MasterData",
      entityType: "ScrapType",
      entityId: id,
      oldValue: { code: existing.code, name: existing.name },
      reason: "Unused Scrap Type deleted",
    });
  });

  revalidatePath("/masters/scrap-types");
  return { ok: true };
}
