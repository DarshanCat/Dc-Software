import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("Admin User Delete & Deactivation E2E Workflow", () => {
  test("Admin can view Delete controls, requires exact email confirmation, and deactivates/removes target user", async ({
    page,
  }) => {
    // Ensure target test user exists & active (re-create if hard deleted by previous test run)
    const existingStores = await prisma.user.findUnique({
      where: { email: "stores@vijayspheroidals.com" },
    });
    if (!existingStores) {
      const storesRole = await prisma.role.findFirst({ where: { key: "STORES" } });
      const bcrypt = (await import("bcryptjs")).default;
      const defaultHash = await bcrypt.hash("Password@123", 10);
      await prisma.user.create({
        data: {
          email: "stores@vijayspheroidals.com",
          name: "Stores User",
          passwordHash: defaultHash,
          active: true,
          mustChangePassword: false,
          ...(storesRole ? { roles: { create: { roleId: storesRole.id } } } : {}),
        },
      });
    } else {
      await prisma.user.update({
        where: { email: "stores@vijayspheroidals.com" },
        data: { active: true },
      });
    }

    // 1. Sign in as Admin
    await page.goto("/login");
    await page.fill('input[name="email"]', "darshan@vijayspheroidals.com");
    await page.fill('input[name="password"]', "Password@123");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    // 2. Navigate to User Management
    await page.goto("/admin/users");
    await expect(page.locator("h1:has-text('User Management')")).toBeVisible();

    // 3. Verify Delete button disabled for self (darshan@vijayspheroidals.com)
    const darshanRow = page.locator("tr", { hasText: "darshan@vijayspheroidals.com" });
    const darshanDeleteBtn = darshanRow.locator("button:has-text('Delete')");
    await expect(darshanDeleteBtn).toBeDisabled();

    // 4. Verify Delete button disabled for protected Admin Aravind
    const aravindRow = page.locator("tr", { hasText: "aravind.gurudev@vijayspheroidals.com" });
    const aravindDeleteBtn = aravindRow.locator("button:has-text('Delete')");
    await expect(aravindDeleteBtn).toBeDisabled();

    // 5. Delete an eligible user row
    const targetRow = page
      .locator("tr")
      .filter({ has: page.locator("td", { hasText: "stores@vijayspheroidals.com" }) })
      .filter({ hasNotText: "nonadmin" })
      .first();
    await expect(targetRow).toBeVisible();

    const deleteBtn = targetRow.locator("button:has-text('Delete')").first();
    await deleteBtn.click();

    // 6. Modal dialog opens
    await expect(page.locator("h3:has-text('Delete User?')")).toBeVisible();
    const confirmInput = page.locator('input[name="confirmEmail"]');
    const confirmDeleteBtn = page.locator("button:has-text('Delete User')");
    await expect(confirmDeleteBtn).toBeDisabled();

    // 7. Fill wrong email -> stays disabled
    await confirmInput.fill("wrong@test.com");
    await expect(confirmDeleteBtn).toBeDisabled();

    // 8. Fill exact email -> enables confirm button
    await confirmInput.fill("stores@vijayspheroidals.com");
    await expect(confirmDeleteBtn).toBeEnabled();

    // 9. Click confirm
    await confirmDeleteBtn.click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h3:has-text('Delete User?')")).not.toBeVisible();
  });
});
