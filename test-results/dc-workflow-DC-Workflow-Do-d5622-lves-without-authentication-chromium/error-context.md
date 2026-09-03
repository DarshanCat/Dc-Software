# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dc-workflow.spec.ts >> DC Workflow & Document Access E2E >> public QR code scan route resolves without authentication
- Location: e2e\dc-workflow.spec.ts:17:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=DC-2026-000001')
Expected: visible
Error: strict mode violation: locator('text=DC-2026-000001') resolved to 3 elements:
    1) <span class="font-mono text-sm font-bold text-slate-900">DC-2026-000001</span> aka locator('span').filter({ hasText: 'DC-2026-' })
    2) <p class="text-sm font-bold text-slate-900 font-mono">DC-2026-000001</p> aka getByRole('article').getByText('DC-2026-')
    3) <p class="mt-3 text-center text-[10px] text-slate-400 print:hidden">…</p> aka getByText('Scanned from the QR printed')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=DC-2026-000001')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]: DC & Vendor Material Management
  - generic [ref=e12]:
    - complementary [ref=e13]:
      - generic [ref=e14]:
        - img "Company Logo" [ref=e15]
        - generic [ref=e16]:
          - generic [ref=e17]: DC & Vendor
          - generic [ref=e18]: Material Management
      - navigation [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Dashboard
          - list [ref=e22]:
            - listitem [ref=e23]:
              - link "Overview" [ref=e24] [cursor=pointer]:
                - /url: /
            - listitem [ref=e25]:
              - link "Open DCs" [ref=e26] [cursor=pointer]:
                - /url: /dashboard/open
            - listitem [ref=e27]:
              - link "Overdue DCs" [ref=e28] [cursor=pointer]:
                - /url: /dashboard/overdue
            - listitem [ref=e29]:
              - link "Material Outside" [ref=e30] [cursor=pointer]:
                - /url: /dashboard/material-outside
            - listitem [ref=e31]:
              - link "Scrap Outstanding" [ref=e32] [cursor=pointer]:
                - /url: /dashboard/scrap-outstanding
            - listitem [ref=e33]:
              - link "Reconciliation Exceptions" [ref=e34] [cursor=pointer]:
                - /url: /dashboard/exceptions
        - generic [ref=e35]:
          - generic [ref=e36]: Work Orders
          - list [ref=e37]:
            - listitem [ref=e38]:
              - link "All Work Orders" [ref=e39] [cursor=pointer]:
                - /url: /work-orders
        - generic [ref=e40]:
          - generic [ref=e41]: Delivery Challans
          - list [ref=e42]:
            - listitem [ref=e43]:
              - link "All DCs" [ref=e44] [cursor=pointer]:
                - /url: /dcs
            - listitem [ref=e45]:
              - link "Create DC" [ref=e46] [cursor=pointer]:
                - /url: /dcs/new
            - listitem [ref=e47]:
              - link "Draft" [ref=e48] [cursor=pointer]:
                - /url: /dcs?status=DRAFT
            - listitem [ref=e49]:
              - link "Pending Approval" [ref=e50] [cursor=pointer]:
                - /url: /dcs?status=PENDING_APPROVAL
            - listitem [ref=e51]:
              - link "Approved" [ref=e52] [cursor=pointer]:
                - /url: /dcs?status=APPROVED
            - listitem [ref=e53]:
              - link "Dispatched" [ref=e54] [cursor=pointer]:
                - /url: /dcs?status=DISPATCHED
            - listitem [ref=e55]:
              - link "At Vendor" [ref=e56] [cursor=pointer]:
                - /url: /dcs?status=AT_VENDOR
            - listitem [ref=e57]:
              - link "Security Returned" [ref=e58] [cursor=pointer]:
                - /url: /dcs?status=SECURITY_RETURNED
            - listitem [ref=e59]:
              - link "Store Verified" [ref=e60] [cursor=pointer]:
                - /url: /dcs?status=STORE_VERIFIED
            - listitem [ref=e61]:
              - link "Final Approved" [ref=e62] [cursor=pointer]:
                - /url: /dcs?status=FINAL_APPROVED
            - listitem [ref=e63]:
              - link "Approved for Payment" [ref=e64] [cursor=pointer]:
                - /url: /dcs?status=APPROVED_FOR_PAYMENT
            - listitem [ref=e65]:
              - link "Close DC" [ref=e66] [cursor=pointer]:
                - /url: /dcs/close
        - generic [ref=e67]:
          - generic [ref=e68]: Material Returns
          - list [ref=e69]:
            - listitem [ref=e70]:
              - link "All Returns" [ref=e71] [cursor=pointer]:
                - /url: /receipts
            - listitem [ref=e72]:
              - link "Receive Material" [ref=e73] [cursor=pointer]:
                - /url: /receipts/new
            - listitem [ref=e74]:
              - link "Pending Returns" [ref=e75] [cursor=pointer]:
                - /url: /receipts?pending=1
            - listitem [ref=e76]:
              - link "Partial Returns" [ref=e77] [cursor=pointer]:
                - /url: /receipts?partial=1
        - generic [ref=e78]:
          - generic [ref=e79]: Scrap Recovery
          - list [ref=e80]:
            - listitem [ref=e81]:
              - link "Scrap Dashboard" [ref=e82] [cursor=pointer]:
                - /url: /scrap
            - listitem [ref=e83]:
              - link "Expected Scrap" [ref=e84] [cursor=pointer]:
                - /url: /scrap?view=expected
            - listitem [ref=e85]:
              - link "Received Scrap" [ref=e86] [cursor=pointer]:
                - /url: /scrap?view=received
            - listitem [ref=e87]:
              - link "Scrap Outstanding" [ref=e88] [cursor=pointer]:
                - /url: /scrap?view=outstanding
            - listitem [ref=e89]:
              - link "Scrap Exceptions" [ref=e90] [cursor=pointer]:
                - /url: /scrap?view=exceptions
        - generic [ref=e91]:
          - generic [ref=e92]: Reconciliation
          - list [ref=e93]:
            - listitem [ref=e94]:
              - link "Pending Reconciliation" [ref=e95] [cursor=pointer]:
                - /url: /reconciliation?status=PENDING
            - listitem [ref=e96]:
              - link "Exceptions" [ref=e97] [cursor=pointer]:
                - /url: /reconciliation?status=EXCEPTION
            - listitem [ref=e98]:
              - link "Reconciled" [ref=e99] [cursor=pointer]:
                - /url: /reconciliation?status=RECONCILED
            - listitem [ref=e100]:
              - link "Closed" [ref=e101] [cursor=pointer]:
                - /url: /reconciliation?status=CLOSED
        - generic [ref=e102]:
          - generic [ref=e103]: Masters
          - list [ref=e104]:
            - listitem [ref=e105]:
              - link "Vendors" [ref=e106] [cursor=pointer]:
                - /url: /masters/vendors
            - listitem [ref=e107]:
              - link "Items" [ref=e108] [cursor=pointer]:
                - /url: /masters/items
            - listitem [ref=e109]:
              - link "Processes" [ref=e110] [cursor=pointer]:
                - /url: /masters/processes
            - listitem [ref=e111]:
              - link "Job Work Standards" [ref=e112] [cursor=pointer]:
                - /url: /masters/job-work-standards
            - listitem [ref=e113]:
              - link "Scrap Types" [ref=e114] [cursor=pointer]:
                - /url: /masters/scrap-types
            - listitem [ref=e115]:
              - link "UOM" [ref=e116] [cursor=pointer]:
                - /url: /masters/uom
        - generic [ref=e117]:
          - generic [ref=e118]: Reports
          - list [ref=e119]:
            - listitem [ref=e120]:
              - link "DC Register" [ref=e121] [cursor=pointer]:
                - /url: /reports/dc-register
            - listitem [ref=e122]:
              - link "Vendor Outstanding" [ref=e123] [cursor=pointer]:
                - /url: /reports/vendor-outstanding
            - listitem [ref=e124]:
              - link "Material Outstanding" [ref=e125] [cursor=pointer]:
                - /url: /reports/material-outstanding
            - listitem [ref=e126]:
              - link "Scrap Recovery" [ref=e127] [cursor=pointer]:
                - /url: /reports/scrap-recovery
            - listitem [ref=e128]:
              - link "Reconciliation" [ref=e129] [cursor=pointer]:
                - /url: /reports/reconciliation
            - listitem [ref=e130]:
              - link "Ageing" [ref=e131] [cursor=pointer]:
                - /url: /reports/ageing
            - listitem [ref=e132]:
              - link "Vendor Performance" [ref=e133] [cursor=pointer]:
                - /url: /reports/vendor-performance
        - generic [ref=e134]:
          - generic [ref=e135]: Administration
          - list [ref=e136]:
            - listitem [ref=e137]:
              - link "Users" [ref=e138] [cursor=pointer]:
                - /url: /admin/users
            - listitem [ref=e139]:
              - link "Registration Requests" [ref=e140] [cursor=pointer]:
                - /url: /admin/users/requests
            - listitem [ref=e141]:
              - link "Roles" [ref=e142] [cursor=pointer]:
                - /url: /admin/roles
            - listitem [ref=e143]:
              - link "Permissions" [ref=e144] [cursor=pointer]:
                - /url: /admin/permissions
            - listitem [ref=e145]:
              - link "Audit Trail" [ref=e146] [cursor=pointer]:
                - /url: /admin/audit
            - listitem [ref=e147]:
              - link "Numbering" [ref=e148] [cursor=pointer]:
                - /url: /admin/numbering
            - listitem [ref=e149]:
              - link "Settings" [ref=e150] [cursor=pointer]:
                - /url: /admin/settings
    - generic [ref=e151]:
      - banner [ref=e152]:
        - generic [ref=e153]: Delivery Challan & Vendor Material Management
        - generic [ref=e154]:
          - button "Notifications" [ref=e156] [cursor=pointer]:
            - generic [ref=e160]: "8"
          - generic [ref=e161]:
            - generic [ref=e162]: darshan@vijayspheroidals.com
            - generic [ref=e163]: ADMIN
          - button "Change Password" [ref=e164] [cursor=pointer]
          - button "Sign out" [ref=e165] [cursor=pointer]
      - main [ref=e166]:
        - generic [ref=e167]:
          - generic [ref=e168]:
            - heading "Admin Full Company Dashboard" [level=1] [ref=e169]
            - paragraph [ref=e170]: Live figures from the database — updates as DCs move through their lifecycle.
          - generic [ref=e171]:
            - generic [ref=e172]:
              - paragraph [ref=e173]: Total Open DCs
              - paragraph [ref=e174]: "13"
            - generic [ref=e175]:
              - paragraph [ref=e176]: Overdue DCs
              - paragraph [ref=e177]: "13"
            - generic [ref=e178]:
              - paragraph [ref=e179]: Material Outside
              - paragraph [ref=e180]: 0.0 kg
            - generic [ref=e181]:
              - paragraph [ref=e182]: Finished Material Pending
              - paragraph [ref=e183]: 0.0 kg
            - generic [ref=e184]:
              - paragraph [ref=e185]: Scrap Pending
              - paragraph [ref=e186]: 0.0 kg
            - generic [ref=e187]:
              - paragraph [ref=e188]: Scrap Recovery %
              - paragraph [ref=e189]: 87.0%
            - generic [ref=e190]:
              - paragraph [ref=e191]: Reconciliation Exceptions
              - paragraph [ref=e192]: "1"
          - generic [ref=e193]:
            - generic [ref=e194]:
              - heading "DC Status Distribution" [level=2] [ref=e195]
              - img [ref=e198]:
                - generic [ref=e202]:
                  - generic [ref=e203]: DRAFT
                  - generic [ref=e205]: CLOSED
                  - generic [ref=e207]: RECONCILIATION
                  - generic [ref=e209]: SECURITY RETURNED
                  - generic [ref=e211]: DISPATCHED
                  - generic [ref=e213]: APPROVED FOR PAYMENT
                - generic [ref=e216]:
                  - generic [ref=e217]: "0"
                  - generic [ref=e219]: "3"
                  - generic [ref=e221]: "6"
                  - generic [ref=e223]: "9"
                  - generic [ref=e225]: "12"
            - generic [ref=e242]:
              - heading "Vendor-wise Outstanding" [level=2] [ref=e243]
              - paragraph [ref=e244]: No material currently outstanding at any vendor.
            - generic [ref=e245]:
              - heading "Overdue Ageing" [level=2] [ref=e246]
              - img [ref=e249]:
                - generic [ref=e253]:
                  - generic [ref=e254]: 0-7 Days
                  - generic [ref=e256]: 8-15 Days
                  - generic [ref=e258]: 16-30 Days
                  - generic [ref=e260]: 31-60 Days
                  - generic [ref=e262]: 60+ Days
                - generic [ref=e265]:
                  - generic [ref=e266]: "0"
                  - generic [ref=e268]: "2"
                  - generic [ref=e270]: "4"
                  - generic [ref=e272]: "6"
                  - generic [ref=e274]: "8"
  - generic [ref=e285]: "2"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("DC Workflow & Document Access E2E", () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto("/login");
  6  |     await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
  7  |     await page.fill('input[name="password"]', "Password@123");
  8  |     await page.click('button[type="submit"]');
  9  |     await expect(page.locator("text=darshan@vijayspheroidals.com")).toBeVisible();
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
> 23 |     await expect(page.locator("text=DC-2026-000001")).toBeVisible();
     |                                                       ^ Error: expect(locator).toBeVisible() failed
  24 |     await context.close();
  25 |   });
  26 | });
  27 | 
```