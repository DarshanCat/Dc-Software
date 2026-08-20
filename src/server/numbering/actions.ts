"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function adjustNumberSequence(
  key: string,
  fiscalYear: string,
  newCurrent: number,
): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.SYSTEM_SETTINGS);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to change numbering." };
    throw e;
  }

  if (!Number.isInteger(newCurrent) || newCurrent < 0) {
    return { ok: false, error: "Value must be a non-negative whole number." };
  }

  const seq = await prisma.numberSequence.findUnique({ where: { key_fiscalYear: { key, fiscalYear } } });
  if (!seq) return { ok: false, error: "Sequence not found." };

  await prisma.$transaction(async (tx) => {
    await tx.numberSequence.update({
      where: { key_fiscalYear: { key, fiscalYear } },
      data: { current: newCurrent },
    });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CHANGED",
      module: "Numbering",
      entityType: "NumberSequence",
      entityId: seq.id,
      oldValue: { current: seq.current },
      newValue: { current: newCurrent },
      reason: `Number sequence ${key}/${fiscalYear} manually adjusted`,
    });
  });

  revalidatePath("/admin/numbering");
  return { ok: true };
}