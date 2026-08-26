import { test, expect } from "@playwright/test";

test.describe("Controlled User Registration & Admin Approval Workflow", () => {
  test("full registration, admin approval, activation, and login flow", async ({ page }) => {
    // 1. Open login and click Create Account
    await page.goto("/login");
    await page.click('text="Create an account"');
    await expect(page).toHaveURL("/register");

    // 2. Fill registration request form
    const uniqueEmail = `test.applicant.${Date.now()}@vijayspheroidals.com`;
    await page.fill('input[name="fullName"]', "New Applicant");
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="employeeId"]', "EMP-999");
    await page.fill('input[name="phone"]', "+91 9876543210");
    await page.selectOption('select[name="requestedDepartment"]', "Production");
    await page.fill('textarea[name="reason"]', "Production manager needs access");

    // 3. Submit registration request
    await page.click('button[type="submit"]');

    // 4. Verify generic approval notice & no active account created
    await expect(
      page.locator("text=If this registration can be processed, it has been submitted for approval.")
    ).toBeVisible();

    // 5. Login as Admin
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);

    // 6. Navigate to /admin/users/requests
    await page.goto("/admin/users/requests");
    await expect(page.locator(`text=${uniqueEmail}`)).toBeVisible();

    // 7. Click Approve on the applicant's request
    const row = page.locator("tr", { hasText: uniqueEmail });
    await row.locator('button:has-text("Approve")').click();

    // 8. Assign Department, Role, and Approving Person's Name in approval modal
    await page.selectOption('div.fixed select:has-option("Production")', "Production");
    await page.selectOption('div.fixed select:has-option("STORES")', "STORES");
    await page.fill('div.fixed input[placeholder*="person approving"]', "Darshan Manager");
    await page.click('button:has-text("Confirm & Approve Account")');

    // 9. Verify activation link modal appears
    await expect(page.locator("text=Account Approved & Created")).toBeVisible();
    await expect(page.locator("text=Email delivery is not configured")).toBeVisible();

    const activationUrlInput = page.locator('div.fixed input[readonly]');
    const activationUrl = await activationUrlInput.inputValue();
    expect(activationUrl).toContain("/activate?token=");

    // Close modal
    await page.click('button:has-text("Done")');

    // 10. Open activation link in browser
    await page.goto(activationUrl);
    await expect(page.locator("text=Set Private Password")).toBeVisible();
    await expect(page.locator(`text=${uniqueEmail}`)).toBeVisible();

    // 11. User sets new password
    const newPassword = "NewUserP@ssword123";
    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);
    await page.click('button[type="submit"]');

    // 12. Verify success confirmation
    await expect(page.locator("text=Account Activated Successfully!")).toBeVisible();
    await page.click('button:has-text("Proceed to Sign In")');

    // 13. Login with newly activated credentials
    await page.goto("/login");
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', newPassword);
    await page.click('button[type="submit"]');

    // 14. Verify successful login
    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);
    await expect(page.locator(`text=${uniqueEmail}`)).toBeVisible();
  });

  test("rejecting a registration request prevents account activation and login", async ({ page }) => {
    // 1. Submit a registration request
    await page.goto("/register");
    const rejectedEmail = `rejected.user.${Date.now()}@vijayspheroidals.com`;
    await page.fill('input[name="fullName"]', "Rejected User");
    await page.fill('input[name="email"]', rejectedEmail);
    await page.selectOption('select[name="requestedDepartment"]', "Quality");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=If this registration can be processed")).toBeVisible();

    // 2. Admin login & navigate to registration requests
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await page.goto("/admin/users/requests");

    // 3. Reject request
    const row = page.locator("tr", { hasText: rejectedEmail });
    await row.locator('button:has-text("Reject")').click();
    await page.fill('textarea', "Unverified employee details");
    await page.click('button:has-text("Reject Request")');

    // 4. Attempt login with rejected email
    await page.goto("/login");
    await page.fill('input[name="email"]', rejectedEmail);
    await page.fill('input[name="password"]', "AnyPassword123!");
    await page.click('button[type="submit"]');

    // 5. Verify rejected message
    await expect(page.locator("text=Your registration was not approved.")).toBeVisible();
  });
});
