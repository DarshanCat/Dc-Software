import { describe, it, expect } from "vitest";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "../src/config/permissions";

describe("13: Vendor Master permission enforcement (address fields ride along VENDOR_EDIT)", () => {
  it("keeps VENDOR_CREATE and VENDOR_EDIT unchanged as the only gates for the vendor address form", () => {
    expect(PERMISSIONS.VENDOR_CREATE).toBe("VENDOR_CREATE");
    expect(PERMISSIONS.VENDOR_EDIT).toBe("VENDOR_EDIT");
  });

  it("denies vendor create/edit (and therefore address entry) to roles without VENDOR_CREATE/VENDOR_EDIT", () => {
    const noVendorWriteRoles = [ROLES.SECURITY, ROLES.QUALITY, ROLES.VENDOR, ROLES.PURCHASE];
    for (const role of noVendorWriteRoles) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role];
      expect(perms, `Role ${role} should NOT have VENDOR_CREATE`).not.toContain(PERMISSIONS.VENDOR_CREATE);
      expect(perms, `Role ${role} should NOT have VENDOR_EDIT`).not.toContain(PERMISSIONS.VENDOR_EDIT);
    }
  });

  it("still grants VENDOR_CREATE/VENDOR_EDIT to STORES, MANAGEMENT and ADMIN only, unchanged by the address feature", () => {
    for (const role of [ROLES.STORES, ROLES.MANAGEMENT]) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role];
      expect(perms).toContain(PERMISSIONS.VENDOR_CREATE);
      expect(perms).toContain(PERMISSIONS.VENDOR_EDIT);
    }
    expect(DEFAULT_ROLE_PERMISSIONS[ROLES.ADMIN]).toContain(PERMISSIONS.VENDOR_EDIT);
  });
});
