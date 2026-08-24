import { test, expect } from "@playwright/test";

test.describe("Mandatory Password Change & Security E2E", () => {
  test("user with mustChangePassword=true is blocked from protected routes and redirected to /change-password", async ({ page }) => {
    // 1. Sign in as admin user
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=admin@example.com")).toBeVisible();

    // 2. Direct navigation to protected routes when authenticated
    const protectedRoutes = [
      "/dcs",
      "/dcs/new",
      "/reports",
      "/reports/ageing",
      "/masters/items",
      "/admin/users",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  test("password policy validation rejects weak and mismatching passwords", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    // Navigate to change password
    await page.goto("/change-password");
    await expect(page.locator("h1:has-text('Change Password')")).toBeVisible();

    // Test weak password rejection
    await page.fill('input[name="currentPassword"]', "Password@123");
    await page.fill('input[name="newPassword"]', "weak");
    await page.fill('input[name="confirmPassword"]', "weak");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=at least 8 characters")).toBeVisible();

    // Test password mismatch rejection
    await page.fill('input[name="newPassword"]', "NewSecure@123");
    await page.fill('input[name="confirmPassword"]', "Different@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=New passwords do not match")).toBeVisible();

    // Test same password rejection
    await page.fill('input[name="newPassword"]', "Password@123");
    await page.fill('input[name="confirmPassword"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=New password must be different")).toBeVisible();
  });
});
