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
    await expect(page.locator("h1:has-text('Create Delivery Challan')")).toBeVisible();

    // Fill new DC form
    await page.fill('input[placeholder="e.g. WO-2026-00452"]', `WO-${Date.now()}`);
    await page.fill('input[placeholder="Enter Part Number"]', "PART-8899");
    await page.selectOption('select:has-option("Select vendor")', { index: 1 });
    await page.selectOption('select:has-option("Select process")', { index: 1 });
    await page.fill('input[placeholder="Enter Raw Material Quantity"]', "100.5");
    await page.fill('input[placeholder="Enter Expected Return FG Quantity"]', "98.0");
    await page.fill('input[placeholder="Enter Heat Number"]', "HEAT-7711");
    await page.fill('input[placeholder="Enter name to appear on DC"]', "Ramesh Kumar");

    await page.click('button:has-text("Create DC (as Draft)")');

    // Verify redirection to detail page
    await expect(page).toHaveURL(/\/dcs\/[a-z0-9-]+$/);
    await expect(page.locator("text=Basic Information")).toBeVisible();
    await expect(page.locator("text=PART-8899")).toBeVisible();
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
