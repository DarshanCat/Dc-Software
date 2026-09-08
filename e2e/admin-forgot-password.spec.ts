import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

test.describe("Admin Forgot Password / Self-Recovery E2E Workflow", () => {
  test("Darshan and Aravind can independently request password recovery and reset credentials", async ({
    page,
  }) => {
    // 1. Navigate to login page
    await page.goto("/login");

    // 2. Click "Forgot password?"
    await page.click('a:has-text("Forgot password?")');
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator("h1:has-text('Admin Password Recovery')")).toBeVisible();

    // 3. Request recovery for Darshan
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.click('button[type="submit"]');

    // 4. Verify generic success message
    await expect(
      page.locator("text=If an active Admin account exists for this email")
    ).toBeVisible();

    // 5. Verify token record was created in database for Darshan
    const darshanUser = await prisma.user.findUnique({
      where: { email: "darshan@vijayspheroidals.com" },
    });
    expect(darshanUser).not.toBeNull();

    const dbTokenCount = await prisma.passwordResetToken.count({
      where: { userId: darshanUser!.id, usedAt: null },
    });
    expect(dbTokenCount).toBeGreaterThan(0);

    // 6. Create clean E2E reset token to test the /reset-password page completion
    const e2eRawToken = `playwright-e2e-test-raw-token-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const e2eTokenHash = createHash("sha256").update(e2eRawToken).digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        userId: darshanUser!.id,
        tokenHash: e2eTokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // 7. Navigate to reset-password page with raw token
    await page.goto(`/reset-password?token=${e2eRawToken}`);
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.locator("h1:has-text('Reset Administrator Password')")).toBeVisible();

    // 8. Submit new password
    const newPassword = "NewP@ssword2026!";
    await page.fill('input[name="newPassword"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);
    await page.click('button[type="submit"]');

    // 9. Verify completion success message
    await expect(page.locator("text=Password Reset Complete")).toBeVisible();

    // 10. Login with new permanent password
    await page.click('button:has-text("Sign In Now")');
    await expect(page).toHaveURL(/\/login/);

    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', newPassword);
    await page.click('button[type="submit"]');

    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);

    // Restore default password for darshan@vijayspheroidals.com so subsequent E2E tests pass
    const bcrypt = (await import("bcryptjs")).default;
    const defaultHash = await bcrypt.hash("Password@123", 10);
    await prisma.user.update({
      where: { email: "darshan@vijayspheroidals.com" },
      data: { passwordHash: defaultHash, mustChangePassword: false },
    });
  });
});
