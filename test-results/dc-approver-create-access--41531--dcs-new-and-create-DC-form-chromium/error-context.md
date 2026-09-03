# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dc-approver-create-access.spec.ts >> DC Approver Role Create DC Access E2E >> Production user (Approver) can access /dcs/new and create DC form
- Location: e2e\dc-approver-create-access.spec.ts:17:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1:has-text(\'Create Delivery Challan\')')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h1:has-text(\'Create Delivery Challan\')')

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
- textbox "Email address":
  - /placeholder: Enter your email address
- text: Password
- textbox "Password":
  - /placeholder: Enter your password
- button "Show password"
- button "Sign in"
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
  3  | test.describe("DC Approver Role Create DC Access E2E", () => {
  4  |   test("Management user (Approver) can access /dcs/new and sees Create DC option", async ({ page }) => {
  5  |     await page.goto("/login");
  6  |     await page.fill('input[name="email"]', "management@vijayspheroidals.com");
  7  |     await page.fill('input[name="password"]', "Password@123");
  8  |     await page.click('button[type="submit"]');
  9  | 
  10 |     await expect(page).toHaveURL(/\/(app|dcs|dashboard)?$/);
  11 | 
  12 |     // Open sidebar/navigation and verify Create DC is visible
  13 |     await page.goto("/dcs/new");
  14 |     await expect(page.locator("h1:has-text('Create Delivery Challan')")).toBeVisible();
  15 |   });
  16 | 
  17 |   test("Production user (Approver) can access /dcs/new and create DC form", async ({ page }) => {
  18 |     await page.goto("/login");
  19 |     await page.fill('input[name="email"]', "production@vijayspheroidals.com");
  20 |     await page.fill('input[name="password"]', "Password@123");
  21 |     await page.click('button[type="submit"]');
  22 | 
  23 |     await page.goto("/dcs/new");
> 24 |     await expect(page.locator("h1:has-text('Create Delivery Challan')")).toBeVisible();
     |                                                                          ^ Error: expect(locator).toBeVisible() failed
  25 |     await expect(page.locator('button[type="submit"]:has-text("Create Delivery Challan")')).toBeVisible();
  26 |   });
  27 | });
  28 | 
```