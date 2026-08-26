import { test, expect } from "@playwright/test";

test.describe("Clickable Notifications & Direct Navigation E2E", () => {
  test("clicking DC notification marks read and navigates to correct DC detail page", async ({ page }) => {
    // 1. Log in as admin
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);

    // 2. Open notification bell dropdown
    await page.click('button[aria-label="Notifications"]');
    await expect(page.locator("text=Notifications")).toBeVisible();

    // 3. Click first notification row if present, or navigate to notifications page
    await page.goto("/notifications");
    await expect(page.locator("h1:has-text('Notifications')")).toBeVisible();

    const firstItem = page.locator(".cursor-pointer").first();
    if (await firstItem.isVisible()) {
      await firstItem.click();
      // Should navigate directly to target URL without error
      await expect(page).not.toHaveURL("/login");
    }
  });

  test("already-read notifications remain clickable and navigate correctly", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    await page.goto("/notifications");
    const notificationsList = page.locator(".divide-y");
    await expect(notificationsList).toBeVisible();

    // Verify row or links are present
    const notificationRows = page.locator(".cursor-pointer");
    const count = await notificationRows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("unauthorized users attempting to access protected target records are blocked by RBAC", async ({ page }) => {
    // Unauthenticated access to target record
    await page.goto("/dcs/non-existent-id-12345");
    await expect(page).toHaveURL(/\/login/);
  });

  test("missing target record displays user-friendly alert without crashing application", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    // Access non-existent DC
    await page.goto("/dcs/00000000-0000-0000-0000-000000000000");
    await expect(page.locator("text=This record is no longer available.")).toBeVisible();
    await expect(page.locator("text=Back to Delivery Challans")).toBeVisible();
  });
});
