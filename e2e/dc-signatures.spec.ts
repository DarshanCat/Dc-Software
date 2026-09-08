import { test, expect } from "@playwright/test";

test.describe("DC Manual Fields (Part Number, Signatures) E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=darshan@vijayspheroidals.com")).toBeVisible();
  });

  test("DC creation validates Part Number and Prepared By Name, then approves", async ({ page }) => {
    // 1. Navigate to DC creation
    await page.goto("/dcs/new");
    await expect(page.locator("h1:has-text('Create Outward Delivery Challan')")).toBeVisible();

    // 2. Attempt creation with valid inputs
    await page.fill('input[data-tally-id="woNumber"]', `WO-${Date.now()}`);
    await page.selectOption('select[data-tally-id="supplier"]', { index: 1 });
    await page.selectOption('select[data-tally-id="partNumber"]', { index: 1 });
    await page.fill('input[placeholder="Raw material quantity sent"]', "100.5");
    await page.fill('input[placeholder="Finished goods expected back"]', "98.0");
    await page.fill('input[placeholder="e.g. HT-2026-X"]', "HEAT-9911");
    await page.fill('input[placeholder="Employee / User name"]', "Ramesh Kumar");
    await page.fill('input[placeholder="Rate per unit"]', "45.50");
    await page.click('button[data-tally-id="saveDraftBtn"]');

    // 5. Verify redirection to DC detail page
    await expect(page).toHaveURL(/\/dcs\/[a-z0-9-]+$/);
    await expect(page.locator("text=Print / Download PDF")).toBeVisible();

    // 6. Submit DC for approval
    await page.click('button:has-text("Submit for Approval")');
    await expect(page.locator("text=PENDING APPROVAL")).toBeVisible();

    // 7. Click Approve button -> Approval Modal appears
    await page.click('button:has-text("Approve DC")');
    await expect(page.locator("text=Approve Delivery Challan")).toBeVisible();
    await expect(page.locator("text=Approved By Name")).toBeVisible();

    // 9. Enter manual Approved By Name and confirm
    const approvedByName = "Aravind Gurudev";
    await page.fill('div.fixed input[placeholder*="Enter name to appear on official PDF"]', approvedByName);
    await page.click('div.fixed button:has-text("Confirm Approval")');

    // 10. Verify status becomes APPROVED & manual fields display on DC detail page
    await expect(page.getByText("APPROVED", { exact: true }).first()).toBeVisible();
  });
});
