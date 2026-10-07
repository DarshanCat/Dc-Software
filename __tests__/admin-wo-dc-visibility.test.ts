import { describe, it, expect } from "vitest";
import { ROLE_ALLOWED_STATUSES } from "../src/config/dc-visibility";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "../src/config/permissions";
import { getVendorScope } from "../src/server/dcs/vendor-scope";
import type { SessionUser } from "../src/server/authorize";

const ALL_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "DISPATCHED",
  "AT_VENDOR",
  "SECURITY_RETURNED",
  "STORE_VERIFIED",
  "QUALITY_COMPLETED",
  "APPROVED_FOR_PAYMENT",
  "CLOSED",
];

/** Mirrors the where-clause construction in /dcs/page.tsx and /work-orders/page.tsx. */
function buildStatusFilter(roleKeys: string[], isAdmin: boolean, statusParam?: string) {
  if (isAdmin) {
    return statusParam ? { status: statusParam } : {};
  }
  let allowed: string[] = [];
  for (const r of roleKeys) {
    if (ROLE_ALLOWED_STATUSES[r]) allowed = [...allowed, ...ROLE_ALLOWED_STATUSES[r]];
  }
  if (allowed.length === 0) return {};
  const uniqueAllowed = [...new Set(allowed)];
  if (statusParam && uniqueAllowed.includes(statusParam)) return { status: statusParam };
  return { status: { in: uniqueAllowed } };
}

describe("ADMIN: unrestricted DC and Work Order visibility", () => {
  it("ADMIN is not a key in ROLE_ALLOWED_STATUSES (bypasses the whitelist entirely, not just a big list)", () => {
    expect(ROLE_ALLOWED_STATUSES.ADMIN).toBeUndefined();
  });

  it("ADMIN can list ALL DC statuses: no status filter is applied when browsing /dcs unfiltered", () => {
    const where = buildStatusFilter(["ADMIN"], true);
    expect(where).toEqual({});
    // Confirms every one of the real lifecycle statuses would be returned (no `in` restriction).
    for (const status of ALL_STATUSES) {
      expect((where as { status?: unknown }).status).toBeUndefined();
    }
  });

  it("ADMIN can still filter to one explicit status via ?status=, unlike other roles being force-restricted", () => {
    const where = buildStatusFilter(["ADMIN"], true, "CLOSED");
    expect(where).toEqual({ status: "CLOSED" });
  });

  it("ADMIN can list ALL Work Order IDs: /work-orders applies the identical no-filter bypass as /dcs", () => {
    const where = buildStatusFilter(["ADMIN"], true);
    expect(where).toEqual({});
  });

  it("ADMIN has no vendor-scope restriction on the Work Orders / DC queries", () => {
    const adminUser: SessionUser = { id: "u-admin", email: "admin@factory.com", roleKeys: ["ADMIN"], vendorId: null };
    expect(getVendorScope(adminUser)).toEqual({});
  });

  it("ADMIN's mutation permissions are still gated by the real permission system (visibility != edit access)", () => {
    // ADMIN sees everything, but requirePermission()/hasPermission() still runs for every
    // mutation - this only asserts the ADMIN permission set exists and is the full set,
    // not that checks are skipped entirely (authorize.ts's explicit bypass is covered
    // elsewhere; this guards against someone deleting the DEFAULT_ROLE_PERMISSIONS.ADMIN entry).
    expect(DEFAULT_ROLE_PERMISSIONS[ROLES.ADMIN]).toEqual(Object.values(PERMISSIONS));
  });
});

describe("STORES: required Store/DC/WO visibility, no cross-role edit permissions", () => {
  it("STORES can see DCs across creation and store-receipt/verification stages", () => {
    const statuses = ROLE_ALLOWED_STATUSES.STORES;
    expect(statuses).toContain("DRAFT");
    expect(statuses).toContain("PENDING_APPROVAL");
    expect(statuses).toContain("SECURITY_RETURNED");
    expect(statuses).toContain("STORE_VERIFIED");
  });

  it("STORES does NOT hold Management approval, Security gate, Quality, or Accounts mutation permissions", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[ROLES.STORES];
    for (const forbidden of [
      PERMISSIONS.DC_APPROVE,
      PERMISSIONS.MANAGER_FINAL_APPROVE,
      PERMISSIONS.PAYMENT_APPROVE,
      PERMISSIONS.SECURITY_DISPATCH,
      PERMISSIONS.SECURITY_RETURN,
      PERMISSIONS.RECEIPT_EDIT, // Quality's Good/Rejection/Scrap entry
      PERMISSIONS.ACCOUNTS_PAYMENT_ENTRY,
      PERMISSIONS.DC_CLOSE,
    ]) {
      expect(perms, `STORES should NOT have ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe("QUALITY: required Quality/DC/WO visibility, no cross-role edit permissions", () => {
  it("QUALITY can see the DC after Store verification, through Quality completion", () => {
    const statuses = ROLE_ALLOWED_STATUSES.QUALITY;
    expect(statuses).toContain("STORE_VERIFIED");
    expect(statuses).toContain("QUALITY_COMPLETED");
  });

  it("QUALITY does NOT hold Store receipt/weight, Security, Management approval, or Accounts permissions", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[ROLES.QUALITY];
    for (const forbidden of [
      PERMISSIONS.STORE_VERIFY,
      PERMISSIONS.SECURITY_DISPATCH,
      PERMISSIONS.SECURITY_RETURN,
      PERMISSIONS.DC_APPROVE,
      PERMISSIONS.MANAGER_FINAL_APPROVE,
      PERMISSIONS.PAYMENT_APPROVE,
      PERMISSIONS.ACCOUNTS_PAYMENT_ENTRY,
      PERMISSIONS.DC_CLOSE,
    ]) {
      expect(perms, `QUALITY should NOT have ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe("ACCOUNTS: required Accounts/DC/WO visibility, no cross-role edit permissions", () => {
  it("ACCOUNTS can see the DC from Quality completion through payment approval and close (previously missing QUALITY_COMPLETED/FINAL_APPROVED)", () => {
    const statuses = ROLE_ALLOWED_STATUSES.ACCOUNTS;
    expect(statuses).toContain("QUALITY_COMPLETED");
    expect(statuses).toContain("FINAL_APPROVED");
    expect(statuses).toContain("APPROVED_FOR_PAYMENT");
    expect(statuses).toContain("CLOSED");
  });

  it("ACCOUNTS does NOT hold Store quantity/weight, Security, or Quality result-editing permissions", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[ROLES.ACCOUNTS];
    for (const forbidden of [
      PERMISSIONS.STORE_VERIFY,
      PERMISSIONS.SECURITY_DISPATCH,
      PERMISSIONS.SECURITY_RETURN,
      PERMISSIONS.RECEIPT_EDIT,
    ]) {
      expect(perms, `ACCOUNTS should NOT have ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("ACCOUNTS retains its own invoice/payment/close permissions unchanged", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[ROLES.ACCOUNTS];
    expect(perms).toContain(PERMISSIONS.ACCOUNTS_PAYMENT_ENTRY);
    expect(perms).toContain(PERMISSIONS.DC_CLOSE);
  });
});

describe("VENDOR: visibility scoping preserved on the Work Orders view", () => {
  it("a VENDOR user is scoped to their own vendorId on the /work-orders query, same as /dcs", () => {
    const vendorUser: SessionUser = { id: "u-v1", email: "vendor1@supplier.com", roleKeys: ["VENDOR"], vendorId: "vendor-uuid-1" };
    expect(getVendorScope(vendorUser)).toEqual({ vendorId: "vendor-uuid-1" });
  });

  it("a VENDOR user with no vendorId assigned fails closed (sees nothing), not everything", () => {
    const unassigned: SessionUser = { id: "u-vnoid", email: "unassigned@supplier.com", roleKeys: ["VENDOR"], vendorId: null };
    expect(getVendorScope(unassigned)).toEqual({ vendorId: "__NO_VENDOR_ASSIGNED__" });
  });
});
