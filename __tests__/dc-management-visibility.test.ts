import { describe, it, expect } from "vitest";
import { ROLE_ALLOWED_STATUSES } from "../src/config/dc-visibility";
import { getVendorScope } from "../src/server/dcs/vendor-scope";
import type { SessionUser } from "../src/server/authorize";

describe("Management DC Visibility (post-approval)", () => {
  it("keeps every lifecycle status Management may need to review, including APPROVED", () => {
    const managementStatuses = ROLE_ALLOWED_STATUSES.MANAGEMENT;

    // 1 & 4: PENDING_APPROVAL DCs are visible before approval, and APPROVED DCs
    // remain visible immediately after Management approves them.
    expect(managementStatuses).toContain("PENDING_APPROVAL");
    expect(managementStatuses).toContain("APPROVED");

    // 7: Management retains visibility through the rest of the lifecycle it cares about.
    for (const status of [
      "DISPATCHED",
      "AT_VENDOR",
      "SECURITY_RETURNED",
      "STORE_VERIFIED",
      "QUALITY_COMPLETED",
      "FINAL_APPROVED",
      "APPROVED_FOR_PAYMENT",
      "CUSTODIAN_VERIFIED",
      "CLOSED",
    ]) {
      expect(managementStatuses, `MANAGEMENT should retain visibility of ${status}`).toContain(status);
    }
  });

  it("does not regress SECURITY's existing visibility of APPROVED DCs", () => {
    // Guards against re-introducing the asymmetry where SECURITY could see APPROVED
    // but MANAGEMENT (who approved it) could not.
    expect(ROLE_ALLOWED_STATUSES.SECURITY).toContain("APPROVED");
    expect(ROLE_ALLOWED_STATUSES.MANAGEMENT).toContain("APPROVED");
  });

  it("6: Management (a non-VENDOR role) has no ownership/vendor scoping applied", () => {
    const managementUser: SessionUser = {
      id: "u-mgmt",
      email: "manager@factory.com",
      roleKeys: ["MANAGEMENT"],
      vendorId: null,
    };
    // An empty scope means the /dcs query is not narrowed by vendor or creator,
    // so DCs created by any STORES user remain visible to Management.
    expect(getVendorScope(managementUser)).toEqual({});
  });

  it("computes the effective Prisma status filter the same way /dcs does for MANAGEMENT", () => {
    const roleKeys = ["MANAGEMENT"];
    let allowed: string[] = [];
    for (const r of roleKeys) {
      if (ROLE_ALLOWED_STATUSES[r]) allowed = [...allowed, ...ROLE_ALLOWED_STATUSES[r]];
    }
    const uniqueAllowed = [...new Set(allowed)];
    expect(uniqueAllowed).toContain("APPROVED");

    // Simulates the where-clause the /dcs page builds for a non-admin MANAGEMENT user.
    const where = { status: { in: uniqueAllowed } };
    expect(where.status.in).toContain("APPROVED");
  });
});
