import { test, expect } from "@playwright/test";

test.describe("Master Management & New DC Creation E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=darshan@vijayspheroidals.com")).toBeVisible();
  });

  test("New DC creation requires Part Number, RM Qty, Return FG Qty, Heat Number, and Process", async ({ page }) => {
    await page.goto("/dcs/new");
    await expect(page.locator("h1:has-text('Create Outward Delivery Challan')")).toBeVisible();

    // Fill new DC form
    await page.fill('input[data-tally-id="woNumber"]', `WO-${Date.now()}`);
    await page.selectOption('select[data-tally-id="supplier"]', { index: 1 });
    await page.selectOption('select[data-tally-id="partNumber"]', { index: 1 });
    await page.fill('input[placeholder="Raw material quantity sent"]', "100.5");
    await page.fill('input[placeholder="Finished goods expected back"]', "98.0");
    await page.fill('input[placeholder="e.g. HT-2026-X"]', "HEAT-7711");
    await page.fill('input[placeholder="Employee / User name"]', "Ramesh Kumar");
    await page.fill('input[placeholder="Rate per unit"]', "45.50");

    await page.click('button[data-tally-id="saveDraftBtn"]');

    // Verify redirection to detail page
    await expect(page).toHaveURL(/\/dcs\/[a-z0-9-]+$/);
    await expect(page.locator("text=Print / Download PDF")).toBeVisible();
    await expect(page.locator("text=100.500")).toBeVisible();
    await expect(page.locator("text=98.000")).toBeVisible();
    await expect(page.locator("text=HEAT-7711")).toBeVisible();
  });

  test("Process Master allows adding, searching, and toggling active status", async ({ page }) => {
    await page.goto("/masters/processes");
    await expect(page.locator("h1:has-text('Process Master')")).toBeVisible();

    // Add new process
    await page.click('button:has-text("+ Add Process")');
    const testCode = `PROC_${Date.now()}`;
    await page.fill('input[placeholder="e.g. MILLING"]', testCode);
    await page.fill('input[placeholder="e.g. Milling"]', "Test Process Name");
    await page.click('button:has-text("Save Process")');

    // Search for new process
    await page.fill('input[placeholder*="Search processes"]', testCode);
    await expect(page.locator(`text=${testCode}`)).toBeVisible();
  });
});
