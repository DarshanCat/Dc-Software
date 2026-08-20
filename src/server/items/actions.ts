"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { itemSchema, type ItemInput } from "@/lib/validation/item";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createItem(input: ItemInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.ITEM_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to create items." };
    throw e;
  }

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.item.findUnique({ where: { itemCode: data.itemCode } });
  if (existing) {
    return { ok: false, error: "Item code already exists.", fieldErrors: { itemCode: "Already in use." } };
  }

  await prisma.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: {
        itemCode: data.itemCode,
        itemName: data.itemName,
        materialGrade: data.materialGrade || null,
        drawingNumber: data.drawingNumber || null,
        defaultUOM: data.defaultUOM || "NOS",
        weightUOM: data.weightUOM || "KG",
        standardUnitWeight: data.standardUnitWeight ?? null,
      },
    });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CHANGED",
      module: "Items",
      entityType: "Item",
      entityId: item.id,
      newValue: { itemCode: item.itemCode, itemName: item.itemName },
      reason: "Item created",
    });
  });

  revalidatePath("/masters/items");
  return { ok: true };
}