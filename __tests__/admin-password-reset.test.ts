import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import {
  requestPasswordReset,
  validatePasswordResetToken,
  completePasswordReset,
} from "@/server/auth/password-reset-actions";
import { getTestCapturedMails, clearTestCapturedMails } from "@/lib/email";

describe("Admin Password Recovery & Reset Security", () => {
  beforeEach(async () => {
    clearTestCapturedMails();
    process.env.PASSWORD_RESET_MAIL_TRANSPORT = "memory";

    // Setup clean test accounts for Darshan, Aravind, and non-admin Stores user
    const adminRole = await prisma.role.upsert({
      where: { key: "ADMIN" },
      create: { key: "ADMIN", name: "Administrator", isSystem: true },
      update: {},
    });

    const storesRole = await prisma.role.upsert({
      where: { key: "STORES" },
      create: { key: "STORES", name: "Stores", isSystem: true },
      update: {},
    });

    const hash = await bcrypt.hash("InitialP@ssword123", 10);

    // Admin 1: Darshan Test Account
    const darshan = await prisma.user.upsert({
      where: { email: "darshan.reset.test@vijayspheroidals.com" },
      create: {
        email: "darshan.reset.test@vijayspheroidals.com",
        name: "Darshan Test",
        passwordHash: hash,
        active: true,
        mustChangePassword: true,
      },
      update: { active: true, passwordHash: hash, mustChangePassword: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: darshan.id, roleId: adminRole.id } },
      create: { userId: darshan.id, roleId: adminRole.id },
      update: {},
    });

    // Admin 2: Aravind Test Account
    const aravind = await prisma.user.upsert({
      where: { email: "aravind.reset.test@vijayspheroidals.com" },
      create: {
        email: "aravind.reset.test@vijayspheroidals.com",
        name: "Aravind Test",
        passwordHash: hash,
        active: true,
        mustChangePassword: false,
      },
      update: { active: true, passwordHash: hash },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: aravind.id, roleId: adminRole.id } },
      create: { userId: aravind.id, roleId: adminRole.id },
      update: {},
    });

    // Non-Admin: Stores User
    const storesUser = await prisma.user.upsert({
      where: { email: "stores.test@vijayspheroidals.com" },
      create: {
        email: "stores.test@vijayspheroidals.com",
        name: "Stores Test",
        passwordHash: hash,
        active: true,
      },
      update: { active: true, passwordHash: hash },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: storesUser.id, roleId: storesRole.id } },
      create: { userId: storesUser.id, roleId: storesRole.id },
      update: {},
    });
  });

  it("allows Darshan to request his own password recovery independently", async () => {
    const res = await requestPasswordReset({ email: "darshan.reset.test@vijayspheroidals.com" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.message).toBe("If an active Admin account exists for this email, a password reset link has been sent.");
    }

    const mails = getTestCapturedMails("darshan.reset.test@vijayspheroidals.com");
    expect(mails.length).toBe(1);
    expect(mails[0].resetUrl).toContain("/reset-password?token=");
  });

  it("allows Aravind to request his own password recovery independently", async () => {
    const res = await requestPasswordReset({ email: "aravind.reset.test@vijayspheroidals.com" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.message).toBe("If an active Admin account exists for this email, a password reset link has been sent.");
    }

    const mails = getTestCapturedMails("aravind.reset.test@vijayspheroidals.com");
    expect(mails.length).toBe(1);
    expect(mails[0].resetUrl).toContain("/reset-password?token=");
  });

  it("rejects non-Admin users from receiving Admin password reset emails while returning a generic anti-enumeration response", async () => {
    const res = await requestPasswordReset({ email: "stores.test@vijayspheroidals.com" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.message).toBe("If an active Admin account exists for this email, a password reset link has been sent.");
    }

    // Non-admin stores user should NOT receive any email or token
    const mails = getTestCapturedMails("stores.test@vijayspheroidals.com");
    expect(mails.length).toBe(0);
  });

  it("rejects invalid external company domains", async () => {
    const res = await requestPasswordReset({ email: "unauthorized@gmail.com" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Please fix the highlighted fields.");
    }
  });

  it("stores token hash in database and never stores raw token", async () => {
    await requestPasswordReset({ email: "darshan.reset.test@vijayspheroidals.com" });
    const mails = getTestCapturedMails("darshan.reset.test@vijayspheroidals.com");
    const rawToken = mails[0].resetUrl.split("token=")[1];

    const expectedHash = createHash("sha256").update(rawToken).digest("hex");
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: expectedHash },
    });

    expect(tokenRecord).not.toBeNull();
    expect(tokenRecord?.tokenHash).toBe(expectedHash);
    expect(tokenRecord?.tokenHash).not.toBe(rawToken);
  });

  it("invalidates previous active reset tokens when a new recovery request is created", async () => {
    await requestPasswordReset({ email: "darshan.reset.test@vijayspheroidals.com" });
    const firstMails = getTestCapturedMails("darshan.reset.test@vijayspheroidals.com");
    const firstRawToken = firstMails[0].resetUrl.split("token=")[1];

    // Request second recovery link
    await requestPasswordReset({ email: "darshan.reset.test@vijayspheroidals.com" });
    const secondMails = getTestCapturedMails("darshan.reset.test@vijayspheroidals.com");
    const secondRawToken = secondMails[1].resetUrl.split("token=")[1];

    // First token should now be invalidated/used
    const firstVal = await validatePasswordResetToken(firstRawToken);
    expect(firstVal.ok).toBe(false);

    // Second token should be valid
    const secondVal = await validatePasswordResetToken(secondRawToken);
    expect(secondVal.ok).toBe(true);
  });

  it("completes password reset cleanly, hashes password with bcrypt, and clears mustChangePassword", async () => {
    await requestPasswordReset({ email: "darshan.reset.test@vijayspheroidals.com" });
    const mails = getTestCapturedMails("darshan.reset.test@vijayspheroidals.com");
    const rawToken = mails[0].resetUrl.split("token=")[1];

    const newPassword = "NewP@ssword2026!";
    const completeRes = await completePasswordReset({
      token: rawToken,
      newPassword,
      confirmPassword: newPassword,
    });

    expect(completeRes.ok).toBe(true);

    const user = await prisma.user.findUnique({
      where: { email: "darshan.reset.test@vijayspheroidals.com" },
    });

    expect(user?.mustChangePassword).toBe(false);
    expect(await bcrypt.compare(newPassword, user!.passwordHash)).toBe(true);
    expect(await bcrypt.compare("InitialP@ssword123", user!.passwordHash)).toBe(false);

    // Token cannot be reused
    const reuseRes = await completePasswordReset({
      token: rawToken,
      newPassword: "AnotherP@ssword123",
      confirmPassword: "AnotherP@ssword123",
    });
    expect(reuseRes.ok).toBe(false);
    if (!reuseRes.ok) {
      expect(reuseRes.error).toBe("Invalid or expired password reset link.");
    }
  });

  it("verifies reset token and password never appear in AuditLog values", async () => {
    await requestPasswordReset({ email: "darshan.reset.test@vijayspheroidals.com" });
    const mails = getTestCapturedMails("darshan.reset.test@vijayspheroidals.com");
    const rawToken = mails[0].resetUrl.split("token=")[1];

    await completePasswordReset({
      token: rawToken,
      newPassword: "NewP@ssword2026!",
      confirmPassword: "NewP@ssword2026!",
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: { action: "PASSWORD_RESET_COMPLETED" },
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    for (const log of auditLogs) {
      const jsonStr = JSON.stringify(log);
      expect(jsonStr).not.toContain(rawToken);
      expect(jsonStr).not.toContain("NewP@ssword2026!");
    }
  });
});
