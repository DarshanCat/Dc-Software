"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import {
  createUserSchema,
  changePasswordSchema,
  type CreateUserInput,
  type ChangePasswordInput,
} from "@/lib/validation/user";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type AdminResetResult =
  | { ok: true; temporaryPassword: string }
  | { ok: false; error: string };

function generateSecureTempPassword(): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%^&*";

  const buf = randomBytes(12);
  const chars = [
    uppercase[buf[0] % uppercase.length],
    lowercase[buf[1] % lowercase.length],
    numbers[buf[2] % numbers.length],
    special[buf[3] % special.length],
  ];

  const all = uppercase + lowercase + numbers + special;
  for (let i = 4; i < 12; i++) {
    chars.push(all[buf[i] % all.length]);
  }

  const shuffleBuf = randomBytes(12);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBuf[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

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
  const normalizedEmail = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
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
        email: normalizedEmail,
        name: data.name.trim(),
        passwordHash,
        vendorId: data.vendorId || null,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "USER_CREATED",
      module: "Users",
      entityType: "User",
      entityId: newUser.id,
      newValue: { email: normalizedEmail, name: data.name, roleKeys: data.roleKeys },
      reason: "User created by Admin",
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

  const action = active ? "USER_ENABLED" : "USER_DISABLED";

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { active } });
    await writeAudit(tx, {
      userId: user!.id,
      action,
      module: "Users",
      entityType: "User",
      entityId: userId,
      newValue: { active },
      reason: active ? "User account enabled by Admin" : "User account disabled by Admin",
    });
  });

  revalidatePath("/admin/users");
  return { ok: true, id: userId };
}

export async function updateUserRoles(userId: string, roleKeys: string[]): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.USER_MANAGE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to manage users." };
    throw e;
  }

  if (!roleKeys || roleKeys.length === 0) {
    return { ok: false, error: "Select at least one role for the user." };
  }

  const roles = await prisma.role.findMany({ where: { key: { in: roleKeys } } });
  if (roles.length !== roleKeys.length) {
    return { ok: false, error: "One or more selected roles do not exist." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!existingUser) return { ok: false, error: "User not found." };

  const oldRoles = existingUser.roles.map((r) => r.role.key);

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({
      data: roles.map((r) => ({ userId, roleId: r.id })),
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "ROLE_CHANGED",
      module: "Users",
      entityType: "User",
      entityId: userId,
      oldValue: { roleKeys: oldRoles },
      newValue: { roleKeys },
      reason: "User roles updated by Admin",
    });
  });

  revalidatePath("/admin/users");
  return { ok: true, id: userId };
}

export async function changePassword(input: ChangePasswordInput): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const userRecord = await prisma.user.findUnique({ where: { id: user.id } });
  if (!userRecord || !userRecord.active) {
    return { ok: false, error: "User account not found or inactive." };
  }

  const passwordMatches = await bcrypt.compare(parsed.data.currentPassword, userRecord.passwordHash);
  if (!passwordMatches) {
    return { ok: false, error: "Current password is incorrect.", fieldErrors: { currentPassword: "Incorrect password." } };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    await writeAudit(tx, {
      userId: user.id,
      action: "PASSWORD_CHANGED",
      module: "Users",
      entityType: "User",
      entityId: user.id,
      reason: "User changed password successfully",
    });
  });

  revalidatePath("/");
  return { ok: true, id: user.id };
}

export async function adminResetPassword(targetUserId: string): Promise<AdminResetResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.USER_MANAGE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to reset user passwords." };
    throw e;
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return { ok: false, error: "Target user not found." };

  const tempPassword = generateSecureTempPassword();
  const tempHash = await bcrypt.hash(tempPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash: tempHash,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
      },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "PASSWORD_RESET_REQUESTED",
      module: "Users",
      entityType: "User",
      entityId: targetUserId,
      reason: "Admin reset user password with temporary credentials",
    });
  });

  revalidatePath("/admin/users");
  return { ok: true, temporaryPassword: tempPassword };
}