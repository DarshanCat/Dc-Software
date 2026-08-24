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

    await expect(page.locator("text=Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated access redirects to /login", async ({ page }) => {
    await page.goto("/dcs");
    await expect(page).toHaveURL(/\/login/);
  });
});
