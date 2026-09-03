# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication & Authorization E2E >> successful login with valid admin credentials
- Location: e2e\auth.spec.ts:4:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/(app|dcs|dashboard)?$/
Received string:  "http://localhost:3000/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="en" class="__variable_246ccd __variable_c29908 h-full antialiased">…</html>
       - unexpected value "http://localhost:3000/login"

```

```yaml
- img "Vijay Spheroidals Logo"
- text: Vijay Spheroidals
- heading "Enterprise Logistics" [level=2]
- text: Industrial Material Tracking System
- heading "DC & Vendor Material Management" [level=1]
- paragraph: Manage delivery challans, vendor material movement, returns, boring recovery, and scrap reconciliation in one unified workspace.
- text: Real-time Challan & Dispatch Tracking Automated Boring & Scrap Reconciliation © 2026 Vijay Spheroidals. All rights reserved.
- img "Vijay Spheroidals Logo"
- heading "Welcome back" [level=2]
- paragraph: Sign in to DC & Vendor Material Management
- text: Email address
- textbox "Email address" [disabled]:
  - /placeholder: Enter your email address
  - text: darshan@vijayspheroidals.com
- text: Password
- textbox "Password" [disabled]:
  - /placeholder: Enter your password
  - text: Password@123
- button "Show password"
- button "Signing in..." [disabled]
- text: Don't have an account?
- link "Create an account":
  - /url: /register
- text: Secure Enterprise Authentication • Vijay Spheroidals
- alert
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Authentication & Authorization E2E", () => {
  4  |   test("successful login with valid admin credentials", async ({ page }) => {
  5  |     await page.goto("/login");
  6  |     await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
  7  |     await page.fill('input[name="password"]', "Password@123");
  8  |     await page.click('button[type="submit"]');
  9  | 
  10 |     // Should redirect to dashboard / home
> 11 |     await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  12 |     await expect(page.locator("text=darshan@vijayspheroidals.com")).toBeVisible();
  13 |   });
  14 | 
  15 |   test("rejected login with invalid password", async ({ page }) => {
  16 |     await page.goto("/login");
  17 |     await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
  18 |     await page.fill('input[name="password"]', "WrongPassword123");
  19 |     await page.click('button[type="submit"]');
  20 | 
  21 |     await expect(page.locator("text=Invalid email or password.")).toBeVisible();
  22 |     await expect(page).toHaveURL("/login");
  23 |   });
  24 | 
  25 |   test("password visibility toggle button", async ({ page }) => {
  26 |     await page.goto("/login");
  27 |     const passwordInput = page.locator('input[name="password"]');
  28 |     const toggleButton = page.locator('button[aria-label="Show password"]');
  29 | 
  30 |     await expect(passwordInput).toHaveAttribute("type", "password");
  31 |     await toggleButton.click();
  32 |     await expect(passwordInput).toHaveAttribute("type", "text");
  33 |   });
  34 | 
  35 |   test("production login UI does not contain dev prefilled text", async ({ page }) => {
  36 |     await page.goto("/login");
  37 |     await expect(page.locator("text=Dev login prefilled")).not.toBeVisible();
  38 |     await expect(page.locator("text=Password@123")).not.toBeVisible();
  39 |   });
  40 | 
  41 |   test("unauthenticated access redirects to /login", async ({ page }) => {
  42 |     await page.goto("/dcs");
  43 |     await expect(page).toHaveURL(/\/login/);
  44 |   });
  45 | });
  46 | 
```