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

const PROTECTED_ADMIN_EMAILS = [
  "darshan@vijayspheroidals.com",
  "aravind.gurudev@vijayspheroidals.com",
] as const;

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

  if (data.roleKeys.includes("ADMIN") && !user?.roleKeys?.includes("ADMIN")) {
    return { ok: false, error: "Only existing Administrators can create ADMIN accounts." };
  }

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

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { ok: false, error: "User not found." };

  if (
    !active &&
    PROTECTED_ADMIN_EMAILS.includes(
      targetUser.email.toLowerCase() as (typeof PROTECTED_ADMIN_EMAILS)[number]
    )
  ) {
    return { ok: false, error: "Protected administrator accounts cannot be deactivated." };
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

  if (userId === user!.id) {
    return { ok: false, error: "You cannot modify your own user roles." };
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

  const isProtectedAdmin = PROTECTED_ADMIN_EMAILS.includes(
    existingUser.email.toLowerCase() as (typeof PROTECTED_ADMIN_EMAILS)[number]
  );
  if (isProtectedAdmin && !roleKeys.includes("ADMIN")) {
    return { ok: false, error: "Protected administrator account roles cannot be downgraded." };
  }

  const involvesAdminRole = roleKeys.includes("ADMIN") || oldRoles.includes("ADMIN");
  if (involvesAdminRole && !user?.roleKeys?.includes("ADMIN")) {
    return { ok: false, error: "Only existing Administrators can assign or modify the ADMIN role." };
  }

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

export async function deleteUser(targetUserId: string, confirmEmail: string): Promise<ActionResult> {
  const adminUser = await getSessionUser();
  try {
    await requirePermission(adminUser, PERMISSIONS.USER_MANAGE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to delete users." };
    throw e;
  }

  if (!adminUser?.roleKeys?.includes("ADMIN")) {
    return { ok: false, error: "Only System Administrators can delete user accounts." };
  }

  if (!targetUserId || !confirmEmail) {
    return { ok: false, error: "Target user ID and email confirmation are required." };
  }

  if (targetUserId === adminUser.id) {
    return { ok: false, error: "You cannot delete your own user account." };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      roles: { include: { role: true } },
      _count: { select: { auditLogs: true } },
    },
  });

  if (!targetUser) {
    return { ok: false, error: "User not found." };
  }

  const isProtectedAdmin = PROTECTED_ADMIN_EMAILS.includes(
    targetUser.email.toLowerCase() as (typeof PROTECTED_ADMIN_EMAILS)[number]
  );
  if (isProtectedAdmin) {
    return { ok: false, error: "Protected administrator accounts cannot be deleted." };
  }

  if (confirmEmail.trim().toLowerCase() !== targetUser.email.toLowerCase()) {
    return { ok: false, error: "The entered email address does not match the user's email." };
  }

  const isTargetAdmin = targetUser.roles.some((r) => r.role.key === "ADMIN");
  if (isTargetAdmin && targetUser.active) {
    const activeAdminCount = await prisma.user.count({
      where: {
        active: true,
        roles: {
          some: {
            role: {
              key: "ADMIN",
            },
          },
        },
      },
    });

    if (activeAdminCount <= 1) {
      return { ok: false, error: "Cannot delete the last active Administrator account." };
    }
  }

  // Check historical business references (DeliveryChallans created/approved/dispatched/closed)
  const dcReferenceCount = await prisma.deliveryChallan.count({
    where: {
      OR: [
        { createdBy: targetUserId },
        { approvedBy: targetUserId },
        { dispatchedBy: targetUserId },
        { closedBy: targetUserId },
        { cancelledBy: targetUserId },
      ],
    },
  });

  const hasHistoricalReferences = targetUser._count.auditLogs > 0 || dcReferenceCount > 0;

  await prisma.$transaction(async (tx) => {
    if (hasHistoricalReferences) {
      // Safe Deactivation / Soft Delete to preserve audit & business accountability
      await tx.user.update({
        where: { id: targetUserId },
        data: { active: false },
      });

      await writeAudit(tx, {
        userId: adminUser.id,
        action: "USER_DELETED",
        module: "Users",
        entityType: "User",
        entityId: targetUserId,
        oldValue: { email: targetUser.email, active: targetUser.active },
        newValue: { active: false, deletionMode: "deactivated_for_audit" },
        reason: `User ${targetUser.email} deactivated by Admin (historical DC/audit records preserved)`,
      });
    } else {
      // True Hard Delete when zero historical dependencies exist
      await tx.userRole.deleteMany({ where: { userId: targetUserId } });
      await tx.passwordResetToken.deleteMany({ where: { userId: targetUserId } });

      await writeAudit(tx, {
        userId: adminUser.id,
        action: "USER_DELETED",
        module: "Users",
        entityType: "User",
        entityId: targetUserId,
        oldValue: { email: targetUser.email, name: targetUser.name },
        newValue: { deletionMode: "hard_deleted" },
        reason: `User ${targetUser.email} permanently deleted by Admin`,
      });

      await tx.user.delete({ where: { id: targetUserId } });
    }
  });

  try {
    revalidatePath("/admin/users");
  } catch {}
  return { ok: true, id: targetUserId };
}