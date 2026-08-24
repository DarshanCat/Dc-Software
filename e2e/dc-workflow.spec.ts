import { test, expect } from "@playwright/test";

test.describe("DC Workflow & Document Access E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=admin@example.com")).toBeVisible();
  });

  test("navigate to DC list page", async ({ page }) => {
    await page.goto("/dcs");
    await expect(page.locator("h1:has-text('Delivery Challans')")).toBeVisible();
  });

  test("public QR code scan route resolves without authentication", async ({ browser }) => {
    const context = await browser.newContext(); // unauthenticated context
    const page = await context.newPage();
    await page.goto("/qr/demo-qr-token-000001");

    await expect(page.locator("text=DELIVERY CHALLAN")).toBeVisible();
    await expect(page.locator("text=DC-2026-000001")).toBeVisible();
    await context.close();
  });
});
