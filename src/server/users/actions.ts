"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { createUserSchema, type CreateUserInput } from "@/lib/validation/user";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.USER_MANAGE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to manage users." };
    throw e;
  }

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { ok: false, error: "A user with this email already exists.", fieldErrors: { email: "Already in use." } };
  }

  const roles = await prisma.role.findMany({ where: { key: { in: data.roleKeys } } });
  if (roles.length !== data.roleKeys.length) {
    return { ok: false, error: "One or more selected roles do not exist." };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        vendorId: data.vendorId || null,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CHANGED",
      module: "Users",
      entityType: "User",
      entityId: newUser.id,
      newValue: { email: data.email, name: data.name, roleKeys: data.roleKeys },
      reason: "User created",
    });

    return newUser.id;
  });

  revalidatePath("/admin/users");
  return { ok: true, id: result };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.USER_MANAGE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to manage users." };
    throw e;
  }

  if (userId === user!.id && !active) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { active } });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CHANGED",
      module: "Users",
      entityType: "User",
      entityId: userId,
      newValue: { active },
      reason: active ? "User reactivated" : "User deactivated",
    });
  });

  revalidatePath("/admin/users");
  return { ok: true, id: userId };
}