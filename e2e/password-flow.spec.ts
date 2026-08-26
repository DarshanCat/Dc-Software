import { test, expect } from "@playwright/test";

test.describe("Mandatory Password Change & Security E2E", () => {
  test("full temporary password workflow: activation, mandatory password change redirect, and login validation", async ({ page }) => {
    // 1. Submit registration request
    const uniqueEmail = `temp.user.${Date.now()}@vijayspheroidals.com`;
    await page.goto("/register");
    await page.fill('input[name="fullName"]', "Temp Account User");
    await page.fill('input[name="email"]', uniqueEmail);
    await page.selectOption('select[name="requestedDepartment"]', "Stores");
    await page.click('button[type="submit"]');

    // 2. Admin approves request & copies activation link
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);

    await page.goto("/admin/users/requests");
    const row = page.locator("tr", { hasText: uniqueEmail });
    await row.locator('button:has-text("Approve")').click();
    await page.selectOption('div.fixed select:has-option("Stores")', "Stores");
    await page.selectOption('div.fixed select:has-option("STORES")', "STORES");
    await page.click('button:has-text("Confirm & Approve Account")');

    const activationUrlInput = page.locator('div.fixed input[readonly]');
    const activationUrl = await activationUrlInput.inputValue();
    await page.click('button:has-text("Done")');

    // 3. User opens activation link and sets private password
    await page.goto(activationUrl);
    const initialTempPassword = "InitialTempP@ss123";
    await page.fill('input[name="password"]', initialTempPassword);
    await page.fill('input[name="confirmPassword"]', initialTempPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Account Activated Successfully!")).toBeVisible();

    // 4. Log in as Admin to perform an Admin Password Reset
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    await page.goto("/admin/users");
    const userRow = page.locator("tr", { hasText: uniqueEmail });
    await userRow.locator('button:has-text("Reset Password")').click();
    await page.click('button:has-text("Confirm Reset")');

    const modalTempPasswordInput = page.locator('div.fixed input[readonly]');
    const adminGeneratedTempPassword = await modalTempPasswordInput.inputValue();
    expect(adminGeneratedTempPassword.length).toBeGreaterThanOrEqual(8);
    await page.click('button:has-text("Done")');

    // 5. User logs in using the Admin generated temporary password
    await page.goto("/login");
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', adminGeneratedTempPassword);
    await page.click('button[type="submit"]');

    // 6. Verify mandatory redirection to /change-password
    await expect(page).toHaveURL(/\/change-password/);
    await expect(page.locator("h1:has-text('Change Password')")).toBeVisible();

    // 7. Verify direct navigation to protected routes is blocked while mustChangePassword=true
    await page.goto("/dcs");
    await expect(page).toHaveURL(/\/change-password/);

    // 8. User changes password successfully
    const permanentPassword = "MyPermanentP@ssword123";
    await page.fill('input[name="currentPassword"]', adminGeneratedTempPassword);
    await page.fill('input[name="newPassword"]', permanentPassword);
    await page.fill('input[name="confirmPassword"]', permanentPassword);
    await page.click('button[type="submit"]');

    // 9. Verify access granted to application dashboard after successful password change
    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);

    // 10. Verify old temporary password no longer works
    await page.goto("/login");
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', adminGeneratedTempPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Invalid email or password.")).toBeVisible();

    // 11. Verify new permanent password works cleanly
    await page.fill('input[name="password"]', permanentPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);
  });

  test("password policy validation rejects weak and mismatching passwords", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    // Navigate to change password
    await page.goto("/change-password");
    await expect(page.locator("h1:has-text('Change Password')")).toBeVisible();

    // Test weak password rejection
    await page.fill('input[name="currentPassword"]', "Password@123");
    await page.fill('input[name="newPassword"]', "weak");
    await page.fill('input[name="confirmPassword"]', "weak");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=at least 8 characters")).toBeVisible();

    // Test password mismatch rejection
    await page.fill('input[name="newPassword"]', "NewSecure@123");
    await page.fill('input[name="confirmPassword"]', "Different@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=New passwords do not match")).toBeVisible();

    // Test same password rejection
    await page.fill('input[name="newPassword"]', "Password@123");
    await page.fill('input[name="confirmPassword"]', "Password@123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=New password must be different")).toBeVisible();
  });
});
