"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { systemSettingsSchema, type SystemSettingsInput } from "@/lib/validation/system-settings";

export type ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveSystemSettings(input: SystemSettingsInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.SYSTEM_SETTINGS);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to change system settings." };
    throw e;
  }

  const parsed = systemSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await tx.systemSetting.upsert({
        where: { key },
        create: { key, value: String(value), group: "general" },
        update: { value: String(value) },
      });
    }
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CHANGED",
      module: "SystemSettings",
      entityType: "SystemSetting",
      entityId: "bulk",
      newValue: data,
      reason: "System settings updated",
    });
  });

  revalidatePath("/admin/settings");
  return { ok: true };
}