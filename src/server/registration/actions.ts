"use server";

import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { notifyUsersWithPermission } from "@/server/notifications/service";
import {
  createRegistrationSchema,
  approveRegistrationSchema,
  rejectRegistrationSchema,
  completeActivationSchema,
  type CreateRegistrationInput,
  type ApproveRegistrationInput,
  type RejectRegistrationInput,
  type CompleteActivationInput,
} from "@/lib/validation/registration";

export type RegistrationSubmitResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ApproveResult =
  | { ok: true; activationToken: string; activationUrl: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ValidateTokenResult =
  | { ok: true; email: string; fullName: string }
  | { ok: false; error: string };

/**
 * Public action for self-registration.
 * NEVER creates an active user account directly.
 * Always returns a generic response to prevent account enumeration.
 */
export async function submitRegistrationRequest(
  input: CreateRegistrationInput
): Promise<RegistrationSubmitResult> {
  const parsed = createRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;
  const normalizedEmail = data.email.trim().toLowerCase();

  // Generic message for security & anti-enumeration
  const GENERIC_SUCCESS = "If this registration can be processed, it has been submitted for approval.";

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return { ok: true, message: GENERIC_SUCCESS };
    }

    const existingPending = await prisma.registrationRequest.findFirst({
      where: {
        email: normalizedEmail,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });
    if (existingPending) {
      return { ok: true, message: GENERIC_SUCCESS };
    }

    await prisma.$transaction(async (tx) => {
      const req = await tx.registrationRequest.create({
        data: {
          fullName: data.fullName,
          email: normalizedEmail,
          employeeId: data.employeeId || null,
          phone: data.phone || null,
          requestedDepartment: data.requestedDepartment,
          reason: data.reason || null,
          status: "PENDING",
        },
      });

      await notifyUsersWithPermission(tx, PERMISSIONS.USER_MANAGE, {
        type: "REGISTRATION_REQUEST",
        title: "New Account Registration",
        body: `${data.fullName} has requested access to DC & Vendor Material Management.`,
        entityType: "RegistrationRequest",
        entityId: req.id,
        targetUrl: "/admin/users/requests",
      });

      await writeAudit(tx, {
        userId: null,
        action: "REGISTRATION_REQUEST_CREATED",
        module: "Users",
        entityType: "RegistrationRequest",
        entityId: req.id,
        newValue: {
          fullName: data.fullName,
          email: normalizedEmail,
          requestedDepartment: data.requestedDepartment,
        },
        reason: "User requested self-registration",
      });
    });

    return { ok: true, message: GENERIC_SUCCESS };
  } catch (err) {
    console.error("Registration request submission error:", err);
    return { ok: false, error: "An error occurred while submitting your registration. Please try again." };
  }
}

/**
 * Fetch all registration requests for Admin review.
 */
export async function getRegistrationRequests(statusFilter?: string) {
  const user = await getSessionUser();
  await requirePermission(user, PERMISSIONS.USER_MANAGE);

  const whereCondition = statusFilter && statusFilter !== "ALL"
    ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" }
    : {};

  return prisma.registrationRequest.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get pending registration request count.
 */
export async function getPendingRegistrationCount(): Promise<number> {
  const user = await getSessionUser();
  if (!user) return 0;

  try {
    await requirePermission(user, PERMISSIONS.USER_MANAGE);
    return prisma.registrationRequest.count({ where: { status: "PENDING" } });
  } catch {
    return 0;
  }
}

/**
 * Admin action to approve a registration request, create inactive account & token.
 */
export async function approveRegistrationRequest(
  input: ApproveRegistrationInput
): Promise<ApproveResult> {
  const adminUser = await getSessionUser();
  try {
    await requirePermission(adminUser, PERMISSIONS.USER_MANAGE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to approve registrations." };
    throw e;
  }

  const parsed = approveRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;

  const role = await prisma.role.findUnique({ where: { key: data.roleKey } });
  if (!role) {
    return { ok: false, error: "The selected role does not exist." };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

  try {
    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.registrationRequest.findUnique({
        where: { id: data.requestId },
      });

      if (!req || req.status !== "PENDING") {
        throw new Error("Registration request was not found or has already been processed.");
      }

      const existingUser = await tx.user.findUnique({ where: { email: req.email } });
      if (existingUser) {
        throw new Error("A user account with this email address already exists.");
      }

      // Random dummy hash so login is impossible until token activation
      const dummyPasswordHash = await bcrypt.hash(randomBytes(16).toString("hex"), 10);

      const newUser = await tx.user.create({
        data: {
          email: req.email,
          name: req.fullName,
          passwordHash: dummyPasswordHash,
          active: false,
          mustChangePassword: true,
          roles: { create: [{ roleId: role.id }] },
        },
      });

      await tx.registrationRequest.update({
        where: { id: req.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: adminUser!.id,
          approvingPersonName: data.approvingPersonName || adminUser?.email || "Admin",
          approvedUserId: newUser.id,
          activationTokenHash: tokenHash,
          activationTokenExpiresAt: expiresAt,
        },
      });

      await writeAudit(tx, {
        userId: adminUser!.id,
        action: "REGISTRATION_REQUEST_APPROVED",
        module: "Users",
        entityType: "RegistrationRequest",
        entityId: req.id,
        newValue: { approvedUserId: newUser.id, roleKey: data.roleKey, department: data.department },
        reason: `Approved registration for ${req.fullName}`,
      });

      await writeAudit(tx, {
        userId: adminUser!.id,
        action: "ROLE_ASSIGNED",
        module: "Users",
        entityType: "User",
        entityId: newUser.id,
        newValue: { roleKey: data.roleKey },
        reason: `Assigned role ${data.roleKey} to ${req.fullName}`,
      });

      await writeAudit(tx, {
        userId: adminUser!.id,
        action: "DEPARTMENT_ASSIGNED",
        module: "Users",
        entityType: "User",
        entityId: newUser.id,
        newValue: { department: data.department },
        reason: `Assigned department ${data.department} to ${req.fullName}`,
      });

      return { rawToken };
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/users/requests");

    const activationUrl = `/activate?token=${result.rawToken}`;
    return { ok: true, activationToken: result.rawToken, activationUrl };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to approve registration.";
    return { ok: false, error: errorMsg };
  }
}

/**
 * Admin action to reject a registration request.
 */
export async function rejectRegistrationRequest(
  input: RejectRegistrationInput
): Promise<ActionResult> {
  const adminUser = await getSessionUser();
  try {
    await requirePermission(adminUser, PERMISSIONS.USER_MANAGE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to reject registrations." };
    throw e;
  }

  const parsed = rejectRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const req = await tx.registrationRequest.findUnique({
        where: { id: data.requestId },
      });

      if (!req || req.status !== "PENDING") {
        throw new Error("Registration request was not found or has already been processed.");
      }

      await tx.registrationRequest.update({
        where: { id: req.id },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedById: adminUser!.id,
          rejectionReason: data.rejectionReason || null,
        },
      });

      await writeAudit(tx, {
        userId: adminUser!.id,
        action: "REGISTRATION_REQUEST_REJECTED",
        module: "Users",
        entityType: "RegistrationRequest",
        entityId: req.id,
        reason: data.rejectionReason || `Rejected registration for ${req.fullName}`,
      });
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/users/requests");

    return { ok: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reject registration.";
    return { ok: false, error: errorMsg };
  }
}

/**
 * Public function to validate activation token.
 */
export async function validateActivationToken(rawToken: string): Promise<ValidateTokenResult> {
  if (!rawToken || typeof rawToken !== "string") {
    return { ok: false, error: "This activation link is invalid or has expired." };
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const req = await prisma.registrationRequest.findFirst({
    where: {
      activationTokenHash: tokenHash,
      status: "APPROVED",
      activationTokenExpiresAt: { gt: new Date() },
    },
  });

  if (!req) {
    return { ok: false, error: "This activation link is invalid or has expired." };
  }

  return { ok: true, email: req.email, fullName: req.fullName };
}

/**
 * Public action for setting initial private password & activating account.
 */
export async function completeAccountActivation(
  input: CompleteActivationInput
): Promise<ActionResult> {
  const parsed = completeActivationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;
  const tokenHash = createHash("sha256").update(data.token).digest("hex");

  try {
    await prisma.$transaction(async (tx) => {
      const req = await tx.registrationRequest.findFirst({
        where: {
          activationTokenHash: tokenHash,
          status: "APPROVED",
          activationTokenExpiresAt: { gt: new Date() },
        },
      });

      if (!req || !req.approvedUserId) {
        throw new Error("This activation link is invalid or has expired.");
      }

      const passwordHash = await bcrypt.hash(data.password, 10);

      await tx.user.update({
        where: { id: req.approvedUserId },
        data: {
          passwordHash,
          active: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });

      // Single-use token: invalidate immediately
      await tx.registrationRequest.update({
        where: { id: req.id },
        data: {
          activationTokenHash: null,
          activationTokenExpiresAt: null,
        },
      });

      await writeAudit(tx, {
        userId: req.approvedUserId,
        action: "ACCOUNT_ACTIVATED",
        module: "Users",
        entityType: "User",
        entityId: req.approvedUserId,
        reason: "User completed account activation and password setup",
      });
    });

    return { ok: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to activate account.";
    return { ok: false, error: errorMsg };
  }
}
