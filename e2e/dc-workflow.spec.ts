import { test, expect } from "@playwright/test";

test.describe("DC Workflow & Document Access E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=darshan@vijayspheroidals.com")).toBeVisible();
  });

  test("navigate to DC list page", async ({ page }) => {
    await page.goto("/dcs");
    await expect(page.locator("h1:has-text('Delivery Challans')")).toBeVisible();
  });
});

test("public QR code scan route resolves without authentication", async ({ page }) => {
  await page.goto("/qr/demo-qr-token-000001");
  await expect(page.locator("text=DELIVERY CHALLAN").first()).toBeVisible();
  await expect(page.getByText("DC-2026-000001").first()).toBeVisible();
});
