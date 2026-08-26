import { describe, it, expect } from "vitest";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "../src/config/permissions";

describe("DC Permission Configuration & Matrix", () => {
  it("keeps DC_CREATE and DC_APPROVE as distinct permissions", () => {
    expect(PERMISSIONS.DC_CREATE).toBe("DC_CREATE");
    expect(PERMISSIONS.DC_APPROVE).toBe("DC_APPROVE");
    expect(PERMISSIONS.DC_CREATE).not.toBe(PERMISSIONS.DC_APPROVE);
  });

  it("ensures every role with DC_APPROVE also has DC_CREATE", () => {
    const rolesWithApprove = Object.entries(DEFAULT_ROLE_PERMISSIONS).filter(
      ([, perms]) => perms.includes(PERMISSIONS.DC_APPROVE)
    );

    expect(rolesWithApprove.length).toBeGreaterThan(0);

    for (const [roleKey, perms] of rolesWithApprove) {
      expect(perms, `Role ${roleKey} has DC_APPROVE but is missing DC_CREATE`).toContain(
        PERMISSIONS.DC_CREATE
      );
    }
  });

  it("verifies expected roles for Creator only (STORES)", () => {
    const storesPerms = DEFAULT_ROLE_PERMISSIONS[ROLES.STORES];
    expect(storesPerms).toContain(PERMISSIONS.DC_CREATE);
    expect(storesPerms).not.toContain(PERMISSIONS.DC_APPROVE);
  });

  it("verifies expected roles for Approver/Creator (MANAGEMENT, PRODUCTION, ACCOUNTS, ADMIN)", () => {
    const approverRoles = [ROLES.ADMIN, ROLES.MANAGEMENT, ROLES.PRODUCTION, ROLES.ACCOUNTS];
    for (const role of approverRoles) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role];
      expect(perms, `Role ${role} should have DC_CREATE`).toContain(PERMISSIONS.DC_CREATE);
      expect(perms, `Role ${role} should have DC_APPROVE`).toContain(PERMISSIONS.DC_APPROVE);
    }
  });

  it("verifies roles without DC creation permission (SECURITY, VENDOR, PURCHASE, QUALITY)", () => {
    const noCreateRoles = [ROLES.SECURITY, ROLES.VENDOR, ROLES.PURCHASE, ROLES.QUALITY];
    for (const role of noCreateRoles) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role];
      expect(perms, `Role ${role} should NOT have DC_CREATE`).not.toContain(PERMISSIONS.DC_CREATE);
      expect(perms, `Role ${role} should NOT have DC_APPROVE`).not.toContain(PERMISSIONS.DC_APPROVE);
    }
  });
});
