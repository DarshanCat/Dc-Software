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
Received string:  "http://localhost:3000/login?email=admin%40example.com&password=Password%40123"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="en" class="__variable_246ccd __variable_c29908 h-full antialiased">…</html>
       - unexpected value "http://localhost:3000/login?email=admin%40example.com&password=Password%40123"

```

```yaml
- img "Vijay Spheroidals Logo"
- heading "Sign in" [level=1]
- paragraph: DC & Vendor Material Management
- text: Email
- textbox: admin@example.com
- text: Password
- textbox: Password@123
- button "Sign in"
- paragraph: "Dev login prefilled. Password for all seeded users: Password@123"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Authentication & Authorization E2E", () => {
  4  |   test("successful login with valid admin credentials", async ({ page }) => {
  5  |     await page.goto("/login");
  6  |     await page.fill('input[name="email"]', "admin@example.com");
  7  |     await page.fill('input[name="password"]', "Password@123");
  8  |     await page.click('button[type="submit"]');
  9  | 
  10 |     // Should redirect to dashboard / home
> 11 |     await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  12 |     await expect(page.locator("text=admin@example.com")).toBeVisible();
  13 |   });
  14 | 
  15 |   test("rejected login with invalid password", async ({ page }) => {
  16 |     await page.goto("/login");
  17 |     await page.fill('input[name="email"]', "admin@example.com");
  18 |     await page.fill('input[name="password"]', "WrongPassword123");
  19 |     await page.click('button[type="submit"]');
  20 | 
  21 |     await expect(page.locator("text=Invalid credentials")).toBeVisible();
  22 |     await expect(page).toHaveURL("/login");
  23 |   });
  24 | 
  25 |   test("unauthenticated access redirects to /login", async ({ page }) => {
  26 |     await page.goto("/dcs");
  27 |     await expect(page).toHaveURL(/\/login/);
  28 |   });
  29 | });
  30 | 
```