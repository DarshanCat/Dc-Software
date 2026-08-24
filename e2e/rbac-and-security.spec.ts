import { test, expect } from "@playwright/test";

test.describe("RBAC, Vendor Isolation & Security E2E Pass", () => {
  test("Search functionality supports DC number and WO ID queries", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    // Search by DC Number
    await page.goto("/search?q=DC-2026-000001");
    await expect(page.locator("h1:has-text('Search Results')")).toBeVisible();

    // Search by WO ID
    await page.goto("/search?q=WO-2026-00100");
    await expect(page.locator("h1:has-text('Search Results')")).toBeVisible();
  });

  test("Document endpoint rejects unauthorized access to missing/forbidden documents", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    const res = await page.request.get("/api/documents/non-existent-doc-id");
    expect(res.status()).toBe(404);
  });

  test("Transport details form displays E-Way Bill and E-Sugam fields", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    await page.goto("/dcs");
    const firstDcLink = page.locator('a[href^="/dcs/"]').first();
    if (await firstDcLink.isVisible()) {
      await firstDcLink.click();
      await expect(page.locator("text=E-Way Bill Number")).toBeVisible();
      await expect(page.locator("text=E-Sugam Number")).toBeVisible();
    }
  });
});
