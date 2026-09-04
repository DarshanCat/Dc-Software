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

export interface CreateItemMasterInput {
  partNumber: string;
  partDescription: string;
  pricingBasis?: "RW" | "FG";
  ratePerQuantity?: number;
  uom?: string;
}

export interface UpdateItemMasterInput extends CreateItemMasterInput {
  id: string;
  active?: boolean;
}

function serializeItem(item: any) {
  if (!item) return null;
  return {
    id: item.id,
    partNumber: item.partNumber,
    partDescription: item.partDescription,
    pricingBasis: item.pricingBasis,
    ratePerQuantity: item.ratePerQuantity != null ? Number(item.ratePerQuantity) : null,
    uom: item.uom,
    active: item.active,
    createdAt: item.createdAt ? item.createdAt.toISOString() : null,
    updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
  };
}

export async function getItemMasters(includeInactive = true) {
  const items = await prisma.itemMaster.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { partNumber: "asc" },
  });
  return items.map(serializeItem);
}

export async function getItemMasterByPartNumber(partNumber: string) {
  if (!partNumber) return null;
  const item = await prisma.itemMaster.findFirst({
    where: { partNumber: partNumber.trim() },
  });
  return serializeItem(item);
}

export async function createItemMaster(input: CreateItemMasterInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.ITEM_CREATE);
  if (!permCheck.ok) return permCheck;

  const partNum = (input.partNumber || "").trim();
  const desc = (input.partDescription || "").trim();

  if (!partNum) return { ok: false, error: "Part Number is required." };
  if (!desc) return { ok: false, error: "Part Description is required." };

  const existing = await prisma.itemMaster.findFirst({ where: { partNumber: partNum } });
  if (existing) {
    return { ok: false, error: `Part Number '${partNum}' already exists.` };
  }

  const rate = input.ratePerQuantity != null && !isNaN(Number(input.ratePerQuantity)) ? Number(input.ratePerQuantity) : null;

  const item = await prisma.itemMaster.create({
    data: {
      partNumber: partNum,
      partDescription: desc,
      pricingBasis: input.pricingBasis || "RW",
      ratePerQuantity: rate != null ? new Prisma.Decimal(rate) : null,
      uom: input.uom?.trim() || "NOS",
      active: true,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "ITEM_MASTER_CREATED",
    module: "MasterData",
    entityType: "ItemMaster",
    entityId: item.id,
    reason: `Created Part Master ${item.partNumber}`,
  });

  revalidatePath("/masters/items");
  revalidatePath("/masters/pricing");
  revalidatePath("/dcs/new");
  return { ok: true, item: serializeItem(item) };
}

export async function updateItemMaster(input: UpdateItemMasterInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.ITEM_EDIT);
  if (!permCheck.ok) return permCheck;

  const partNum = (input.partNumber || "").trim();
  const desc = (input.partDescription || "").trim();

  if (!input.id) return { ok: false, error: "Item ID is required." };
  if (!partNum) return { ok: false, error: "Part Number is required." };
  if (!desc) return { ok: false, error: "Part Description is required." };

  const existing = await prisma.itemMaster.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "Item Master record not found." };

  const duplicate = await prisma.itemMaster.findFirst({
    where: { partNumber: partNum, NOT: { id: input.id } },
  });
  if (duplicate) {
    return { ok: false, error: `Part Number '${partNum}' is used by another record.` };
  }

  const rate = input.ratePerQuantity != null && !isNaN(Number(input.ratePerQuantity)) ? Number(input.ratePerQuantity) : null;

  const item = await prisma.itemMaster.update({
    where: { id: input.id },
    data: {
      partNumber: partNum,
      partDescription: desc,
      pricingBasis: input.pricingBasis || existing.pricingBasis,
      ratePerQuantity: rate != null ? new Prisma.Decimal(rate) : null,
      uom: input.uom?.trim() || existing.uom,
      active: input.active ?? existing.active,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "ITEM_MASTER_UPDATED",
    module: "MasterData",
    entityType: "ItemMaster",
    entityId: item.id,
    reason: `Updated Part Master ${item.partNumber}`,
  });

  revalidatePath("/masters/items");
  revalidatePath("/masters/pricing");
  revalidatePath("/dcs/new");
  return { ok: true, item: serializeItem(item) };
}

export async function toggleItemMasterStatus(id: string) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.ITEM_EDIT);
  if (!permCheck.ok) return permCheck;

  const existing = await prisma.itemMaster.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Item Master record not found." };

  const item = await prisma.itemMaster.update({
    where: { id },
    data: { active: !existing.active },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "ITEM_MASTER_STATUS_TOGGLED",
    module: "MasterData",
    entityType: "ItemMaster",
    entityId: item.id,
    reason: `Item Master ${item.partNumber} active set to ${item.active}`,
  });

  revalidatePath("/masters/items");
  revalidatePath("/masters/pricing");
  revalidatePath("/dcs/new");
  return { ok: true, active: item.active };
}
