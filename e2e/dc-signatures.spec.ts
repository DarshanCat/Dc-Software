import { test, expect } from "@playwright/test";

test.describe("DC Manual Fields (Part Number, Expected Scrap, Signatures) E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=admin@example.com")).toBeVisible();
  });

  test("DC creation validates Part Number, Expected Scrap, and Prepared By Name, then approves", async ({ page }) => {
    // 1. Navigate to DC creation
    await page.goto("/dcs/new");
    await expect(page.locator("h1:has-text('Create Delivery Challan')")).toBeVisible();

    // 2. Attempt creation with empty Part Number
    await page.fill('input[placeholder="e.g. WO-2026-00452"]', `WO-${Date.now()}`);
    await page.selectOption('select:has-option("Select vendor")', { index: 1 });
    await page.selectOption('select:has-option("Select process")', { index: 1 });
    await page.selectOption('select:has-option("Select item")', { index: 1 });
    await page.fill('input[type="number"] >> nth=0', "10");
    await page.fill('input[type="number"] >> nth=1', "50");
    await page.fill('input[placeholder="Enter name to appear on DC"]', "Ramesh Kumar");
    await page.click('button:has-text("Create DC (as Draft)")');

    // 3. Verify validation error for Part Number
    await expect(page.locator("text=Part Number is required.")).toBeVisible();

    // 4. Fill manual Part Number & Expected Scrap
    const partNumber = "ABC-12345";
    const expectedScrap = "2.5";
    const preparedByName = "Ramesh Kumar";
    await page.fill('input[placeholder="Enter Part Number"]', partNumber);
    await page.fill('input[placeholder="Enter expected scrap quantity"]', expectedScrap);
    await page.click('button:has-text("Create DC (as Draft)")');

    // 5. Verify redirection to DC detail page & Part Number / Expected Scrap / Prepared By display
    await expect(page).toHaveURL(/\/dcs\/[a-z0-9-]+$/);
    await expect(page.locator("text=DC Movement Specifications")).toBeVisible();
    await expect(page.locator(`text=${partNumber}`)).toBeVisible();
    await expect(page.locator("text=2.500 kg")).toBeVisible();
    await expect(page.locator(`text=${preparedByName}`)).toBeVisible();

    // 6. Submit DC for approval
    await page.click('button:has-text("Submit for Approval")');
    await expect(page.locator("text=PENDING APPROVAL")).toBeVisible();

    // 7. Click Approve button -> Approval Modal appears
    await page.click('button:has-text("Approve")');
    await expect(page.locator("text=Approve Delivery Challan")).toBeVisible();
    await expect(page.locator("text=Approved By Name")).toBeVisible();

    // 8. Attempt approval with empty Approved By Name
    await page.click('div.fixed button:has-text("Approve DC")');
    await expect(page.locator("text=Approved By Name is required.")).toBeVisible();

    // 9. Enter manual Approved By Name and confirm
    const approvedByName = "Aravind Gurudev";
    await page.fill('div.fixed input[placeholder*="Enter name to appear on DC"]', approvedByName);
    await page.click('div.fixed button:has-text("Approve DC")');

    // 10. Verify status becomes APPROVED & all manual fields display on DC detail page
    await expect(page.locator("text=APPROVED")).toBeVisible();
    await expect(page.locator(`text=${preparedByName}`)).toBeVisible();
    await expect(page.locator(`text=${approvedByName}`)).toBeVisible();
  });
});
