"use server";

import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { writeAudit } from "@/server/audit";
import {
  requestPasswordResetSchema,
  resetPasswordCompletionSchema,
  type RequestPasswordResetInput,
  type ResetPasswordCompletionInput,
} from "@/lib/validation/user";

export type RequestResetResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ValidateResetTokenResult =
  | { ok: true; email: string; name: string }
  | { ok: false; error: string };

export type CompleteResetResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const GENERIC_RESET_MESSAGE =
  "If an active Admin account exists for this email, a password reset link has been sent.";

/**
 * Initiate Admin Password Recovery (Self-Recovery).
 * Generic response prevents account enumeration.
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput
): Promise<RequestResetResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    // Verify user exists, is active, and possesses the ADMIN role
    const hasAdminRole = user?.roles.some((r) => r.role.key === "ADMIN");
    if (!user || !user.active || !hasAdminRole) {
      return { ok: true, message: GENERIC_RESET_MESSAGE };
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 Minutes

    // Transactionally invalidate prior tokens and insert new reset token
    const tokenRecord = await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      return tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    const baseUrl = (
      process.env.APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    const mailSent = await sendPasswordResetEmail({
      to: user.email,
      recipientName: user.name,
      resetUrl,
    });

    // CORRECTION 2: If mail delivery fails, invalidate/delete the token record immediately
    if (!mailSent) {
      await prisma.passwordResetToken.delete({
        where: { id: tokenRecord.id },
      }).catch(() => {});
    }

    return { ok: true, message: GENERIC_RESET_MESSAGE };
  } catch (err) {
    console.error("Password reset request error:", err);
    return { ok: true, message: GENERIC_RESET_MESSAGE };
  }
}

/**
 * Validate reset token for Reset Password page.
 */
export async function validatePasswordResetToken(
  rawToken: string
): Promise<ValidateResetTokenResult> {
  if (!rawToken || typeof rawToken !== "string") {
    return { ok: false, error: "Invalid password reset link." };
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt !== null) {
      return { ok: false, error: "Invalid or already used password reset link." };
    }

    if (record.expiresAt < new Date()) {
      return { ok: false, error: "Password reset link has expired." };
    }

    if (!record.user || !record.user.active) {
      return { ok: false, error: "Account is inactive or disabled." };
    }

    return { ok: true, email: record.user.email, name: record.user.name };
  } catch {
    return { ok: false, error: "Failed to validate reset token." };
  }
}

/**
 * Complete Admin Password Reset.
 */
export async function completePasswordReset(
  input: ResetPasswordCompletionInput
): Promise<CompleteResetResult> {
  const parsed = resetPasswordCompletionSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const { token: rawToken, newPassword } = parsed.data;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      return { ok: false, error: "Invalid or expired password reset link." };
    }

    if (!record.user || !record.user.active) {
      return { ok: false, error: "Account is inactive or disabled." };
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      await writeAudit(tx, {
        userId: record.userId,
        action: "PASSWORD_RESET_COMPLETED",
        module: "Users",
        entityType: "User",
        entityId: record.userId,
        reason: "Admin password recovered using independent one-time link",
      });
    });

    return { ok: true };
  } catch (err) {
    console.error("Password reset completion error:", err);
    return { ok: false, error: "An error occurred while resetting your password." };
  }
}
