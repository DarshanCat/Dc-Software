import { test, expect } from "@playwright/test";

test.describe("Authentication & Authorization E2E", () => {
  test("successful login with valid admin credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');

    // Should redirect to dashboard / home
    await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);
    await expect(page.locator("text=admin@example.com")).toBeVisible();
  });

  test("rejected login with invalid password", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "WrongPassword123");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("password visibility toggle button", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.locator('input[name="password"]');
    const toggleButton = page.locator('button[aria-label="Show password"]');

    await expect(passwordInput).toHaveAttribute("type", "password");
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");
  });

  test("production login UI does not contain dev prefilled text", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Dev login prefilled")).not.toBeVisible();
    await expect(page.locator("text=Password@123")).not.toBeVisible();
  });

  test("unauthenticated access redirects to /login", async ({ page }) => {
    await page.goto("/dcs");
    await expect(page).toHaveURL(/\/login/);
  });
});
