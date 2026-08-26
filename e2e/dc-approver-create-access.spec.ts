import { test, expect } from "@playwright/test";

test.describe("DC Approver Role Create DC Access E2E", () => {
  test("Management user (Approver) can access /dcs/new and sees Create DC option", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "management@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);

    // Open sidebar/navigation and verify Create DC is visible
    await page.goto("/dcs/new");
    await expect(page.locator("h1:has-text('Create Delivery Challan')")).toBeVisible();
  });

  test("Production user (Approver) can access /dcs/new and create DC form", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "production@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    await page.goto("/dcs/new");
    await expect(page.locator("h1:has-text('Create Delivery Challan')")).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Create Delivery Challan")')).toBeVisible();
  });
});
