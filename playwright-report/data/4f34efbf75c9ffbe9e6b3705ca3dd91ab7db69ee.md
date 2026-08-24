# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dc-workflow.spec.ts >> DC Workflow & Document Access E2E >> public QR code scan route resolves without authentication
- Location: e2e\dc-workflow.spec.ts:17:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[name="email"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Sign in" [level=1] [ref=e5]
      - paragraph [ref=e6]: DC & Vendor Material Management
    - generic [ref=e7]:
      - generic [ref=e8]:
        - text: Email
        - textbox [ref=e9]: admin@example.com
      - generic [ref=e10]:
        - text: Password
        - textbox [ref=e11]: Password@123
      - button "Sign in" [ref=e12]
    - paragraph [ref=e13]: "Dev login prefilled. Password for all seeded users: Password@123"
  - button "Open Next.js Dev Tools" [ref=e19] [cursor=pointer]
  - alert [ref=e23]: Sign in
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("DC Workflow & Document Access E2E", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto("/login");
> 6  |     await page.fill('input[name="email"]', "admin@example.com");
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  7  |     await page.fill('input[name="password"]', "Password@123");
  8  |     await page.click('button[type="submit"]');
  9  |     await expect(page.locator("text=admin@example.com")).toBeVisible();
  10 |   });
  11 | 
  12 |   test("navigate to DC list page", async ({ page }) => {
  13 |     await page.goto("/dcs");
  14 |     await expect(page.locator("h1:has-text('Delivery Challans')")).toBeVisible();
  15 |   });
  16 | 
  17 |   test("public QR code scan route resolves without authentication", async ({ browser }) => {
  18 |     const context = await browser.newContext(); // unauthenticated context
  19 |     const page = await context.newPage();
  20 |     await page.goto("/qr/demo-qr-token-000001");
  21 | 
  22 |     await expect(page.locator("text=DELIVERY CHALLAN")).toBeVisible();
  23 |     await expect(page.locator("text=DC-2026-000001")).toBeVisible();
  24 |     await context.close();
  25 |   });
  26 | });
  27 | 
```