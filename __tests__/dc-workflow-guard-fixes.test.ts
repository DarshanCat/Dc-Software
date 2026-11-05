import { describe, it, expect, vi, beforeEach } from "vitest";

// Module-level because vi.mock is hoisted above all other module code.
const dcStore = new Map<string, any>();

const prismaMock = {
  deliveryChallan: {
    findUnique: vi.fn(async ({ where }: any) => (where.id ? dcStore.get(where.id) ?? null : null)),
    update: vi.fn(async ({ where, data }: any) => {
      const existing = dcStore.get(where.id);
      const updated = { ...existing, ...data };
      dcStore.set(where.id, updated);
      return updated;
    }),
  },
  statusHistory: { create: vi.fn().mockResolvedValue({}) },
  auditLog: { create: vi.fn().mockResolvedValue({}) },
  user: { findMany: vi.fn().mockResolvedValue([]) },
  notification: { create: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn((arg: any) => (typeof arg === "function" ? arg(prismaMock) : Promise.all(arg))),
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/server/audit", () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/server/notifications/service", () => ({
  notifyUsersWithPermission: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

let currentUser: any = { id: "u-security", email: "security@factory.com", roleKeys: ["SECURITY"] };
vi.mock("../src/server/session", () => ({ getSessionUser: vi.fn(() => Promise.resolve(currentUser)) }));

// requirePermission grants whatever permission the current test's user is set
// up to have, via `currentUser.grantedPermissions` - this lets tests assert
// exactly which permission constant a function gates on, not just "some
// permission was required".
vi.mock("../src/server/authorize", () => ({
  requirePermission: vi.fn(async (user: any, permission: string) => {
    if (!user?.grantedPermissions?.includes(permission)) {
      const err: any = new Error("Forbidden");
      err.name = "ForbiddenError";
      throw err;
    }
    return user;
  }),
  hasPermission: vi.fn(async () => true),
  ForbiddenError: class ForbiddenError extends Error {},
  UnauthenticatedError: class UnauthenticatedError extends Error {},
}));

function setDc(id: string, data: Record<string, any>) {
  dcStore.set(id, { id, ...data });
}

beforeEach(() => {
  dcStore.clear();
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([]);
});

describe("recordInwardReceipt - now enforces DISPATCHED/AT_VENDOR precondition", () => {
  beforeEach(() => {
    currentUser = { id: "u-security", email: "security@factory.com", roleKeys: ["SECURITY"], grantedPermissions: ["SECURITY_RETURN"] };
  });

  it("rejects a DC still in DRAFT - cannot skip approval/dispatch straight to SECURITY_RETURNED", async () => {
    setDc("dc-1", { status: "DRAFT", dcNumber: "DC-1" });
    const { recordInwardReceipt } = await import("../src/server/dcs/extended-actions");
    const res = await recordInwardReceipt({ dcId: "dc-1", actualInwardQty: 10 } as any);
    expect(res.ok).toBe(false);
    expect(dcStore.get("dc-1").status).toBe("DRAFT");
  });

  it("accepts a DC in DISPATCHED status", async () => {
    setDc("dc-2", { status: "DISPATCHED", dcNumber: "DC-2", invoiceNumber: null });
    const { recordInwardReceipt } = await import("../src/server/dcs/extended-actions");
    const res = await recordInwardReceipt({ dcId: "dc-2", actualInwardQty: 10 } as any);
    expect(res.ok).toBe(true);
    expect(dcStore.get("dc-2").status).toBe("SECURITY_RETURNED");
  });

  it("accepts a DC in AT_VENDOR status", async () => {
    setDc("dc-3", { status: "AT_VENDOR", dcNumber: "DC-3", invoiceNumber: null });
    const { recordInwardReceipt } = await import("../src/server/dcs/extended-actions");
    const res = await recordInwardReceipt({ dcId: "dc-3", actualInwardQty: 10 } as any);
    expect(res.ok).toBe(true);
  });
});

describe("confirmStoreReceipt - now enforces SECURITY_RETURNED precondition", () => {
  beforeEach(() => {
    currentUser = { id: "u-stores", email: "stores@factory.com", roleKeys: ["STORES"], grantedPermissions: ["STORE_VERIFY"] };
  });

  it("rejects a DC still in DRAFT - cannot record a quantity for material never received at the gate", async () => {
    setDc("dc-4", { status: "DRAFT", dcNumber: "DC-4", actualInwardQty: null, securityFgQuantity: null });
    const { confirmStoreReceipt } = await import("../src/server/dcs/extended-actions");
    const res = await confirmStoreReceipt({ dcId: "dc-4", storeReceivedQty: 999 } as any);
    expect(res.ok).toBe(false);
    expect(dcStore.get("dc-4").status).toBe("DRAFT");
  });

  it("accepts a DC in SECURITY_RETURNED status", async () => {
    setDc("dc-5", { status: "SECURITY_RETURNED", dcNumber: "DC-5", actualInwardQty: 10, securityFgQuantity: 10 });
    const { confirmStoreReceipt } = await import("../src/server/dcs/extended-actions");
    const res = await confirmStoreReceipt({ dcId: "dc-5", storeReceivedQty: 10 } as any);
    expect(res.ok).toBe(true);
    expect(dcStore.get("dc-5").status).toBe("STORE_VERIFIED");
  });
});

describe("reviewPreOutwardManagerApproval - status and self-approval guards", () => {
  beforeEach(() => {
    currentUser = { id: "u-mgmt", email: "manager@factory.com", roleKeys: ["MANAGEMENT"], grantedPermissions: ["DC_APPROVE"] };
  });

  it("rejects a DRAFT DC - approval requires the DC to have actually been submitted (PENDING_APPROVAL)", async () => {
    setDc("dc-6", { status: "DRAFT", dcNumber: "DC-6", createdBy: "someone-else" });
    const { reviewPreOutwardManagerApproval } = await import("../src/server/dcs/extended-actions");
    const res = await reviewPreOutwardManagerApproval({ dcId: "dc-6", action: "APPROVE" });
    expect(res.ok).toBe(false);
    expect(dcStore.get("dc-6").status).toBe("DRAFT");
  });

  it("rejects self-approval - a creator with DC_APPROVE cannot approve their own outward DC", async () => {
    setDc("dc-7", { status: "PENDING_APPROVAL", dcNumber: "DC-7", createdBy: "u-mgmt" });
    const { reviewPreOutwardManagerApproval } = await import("../src/server/dcs/extended-actions");
    const res = await reviewPreOutwardManagerApproval({ dcId: "dc-7", action: "APPROVE" });
    expect(res.ok).toBe(false);
    expect(dcStore.get("dc-7").status).toBe("PENDING_APPROVAL");
  });

  it("accepts approval of a PENDING_APPROVAL DC created by someone else", async () => {
    setDc("dc-8", { status: "PENDING_APPROVAL", dcNumber: "DC-8", createdBy: "someone-else" });
    const { reviewPreOutwardManagerApproval } = await import("../src/server/dcs/extended-actions");
    const res = await reviewPreOutwardManagerApproval({ dcId: "dc-8", action: "APPROVE" });
    expect(res.ok).toBe(true);
    expect(dcStore.get("dc-8").status).toBe("APPROVED");
  });

  it("ADMIN may still approve a DC they created themselves", async () => {
    currentUser = { id: "u-admin", email: "admin@factory.com", roleKeys: ["ADMIN"], grantedPermissions: ["DC_APPROVE"] };
    setDc("dc-9", { status: "PENDING_APPROVAL", dcNumber: "DC-9", createdBy: "u-admin" });
    const { reviewPreOutwardManagerApproval } = await import("../src/server/dcs/extended-actions");
    const res = await reviewPreOutwardManagerApproval({ dcId: "dc-9", action: "APPROVE" });
    expect(res.ok).toBe(true);
  });
});

describe("submitPaymentApproval - RW pricing basis now prices by raw/outward quantity, not Quality's Good Qty", () => {
  beforeEach(() => {
    currentUser = { id: "u-mgmt", email: "manager@factory.com", roleKeys: ["MANAGEMENT"], grantedPermissions: ["PAYMENT_APPROVE"] };
  });

  it("computes finalPayableAmount from outwardQtyRw for an RW-priced outward DC, without requiring Good Qty", async () => {
    setDc("dc-10", {
      status: "QUALITY_COMPLETED",
      dcNumber: "DC-10",
      pricingBasis: "RW",
      ratePerQuantity: 100,
      outwardQtyRw: 50,
      rmQuantity: null,
      goodQty: null,
      isCommercialService: false,
    });
    const { submitPaymentApproval } = await import("../src/server/dcs/actions");
    const res = await submitPaymentApproval("dc-10");
    expect(res.ok).toBe(true);
    expect(Number(dcStore.get("dc-10").finalPayableAmount)).toBe(5000);
  });

  it("still computes finalPayableAmount from rmQuantity for an RM-priced Material DC", async () => {
    setDc("dc-11", {
      status: "QUALITY_COMPLETED",
      dcNumber: "DC-11",
      pricingBasis: "RM",
      ratePerQuantity: 10,
      rmQuantity: 100,
      goodQty: null,
      isCommercialService: false,
    });
    const { submitPaymentApproval } = await import("../src/server/dcs/actions");
    const res = await submitPaymentApproval("dc-11");
    expect(res.ok).toBe(true);
    expect(Number(dcStore.get("dc-11").finalPayableAmount)).toBe(1000);
  });

  it("FG-priced DCs still require Quality's Good Qty (unaffected by the RW fix)", async () => {
    setDc("dc-12", {
      status: "QUALITY_COMPLETED",
      dcNumber: "DC-12",
      pricingBasis: "FG",
      ratePerQuantity: 10,
      goodQty: null,
      isCommercialService: false,
    });
    const { submitPaymentApproval } = await import("../src/server/dcs/actions");
    const res = await submitPaymentApproval("dc-12");
    expect(res.ok).toBe(false);
  });
});

describe("submitQualityInspection - reconciliation check tolerates floating-point rounding", () => {
  beforeEach(() => {
    currentUser = { id: "u-quality", email: "quality@factory.com", roleKeys: ["QUALITY"], grantedPermissions: ["RECEIPT_EDIT"] };
  });

  it("accepts Good + Rejection + Scrap that is mathematically exact but not binary-float-exact (10.1 + 0.2 !== 10.3)", async () => {
    setDc("dc-13", { status: "STORE_VERIFIED", dcNumber: "DC-13", storeReceivedQty: 10.3, actualInwardQty: null, securityFgQuantity: null });
    const { submitQualityInspection } = await import("../src/server/dcs/extended-actions");
    const res = await submitQualityInspection({ dcId: "dc-13", goodQty: 10.1, rejectionQty: 0.2, scrapQty: 0, qualityDecision: "PASSED" });
    expect(res.ok).toBe(true);
  });

  it("still rejects a genuinely wrong sum (not just a float-rounding artifact)", async () => {
    setDc("dc-14", { status: "STORE_VERIFIED", dcNumber: "DC-14", storeReceivedQty: 10, actualInwardQty: null, securityFgQuantity: null });
    const { submitQualityInspection } = await import("../src/server/dcs/extended-actions");
    const res = await submitQualityInspection({ dcId: "dc-14", goodQty: 5, rejectionQty: 2, scrapQty: 1, qualityDecision: "PARTIAL_ACCEPTANCE" });
    expect(res.ok).toBe(false);
  });
});

describe("Permission constants fixed to match the actual authority required", () => {
  it("submitCustodianVerification now requires STORE_VERIFY, not the universally-granted DC_VIEW", async () => {
    currentUser = { id: "u-quality", email: "quality@factory.com", roleKeys: ["QUALITY"], grantedPermissions: ["DC_VIEW"] };
    setDc("dc-15", { status: "SECURITY_RETURNED", dcNumber: "DC-15", movementType: "TOOL", isCommercialService: false, items: [] });
    const { submitCustodianVerification } = await import("../src/server/dcs/actions");
    const res = await submitCustodianVerification("dc-15", {});
    expect(res.ok).toBe(false);
  });

  it("submitCustodianVerification succeeds for a user holding STORE_VERIFY", async () => {
    currentUser = { id: "u-stores", email: "stores@factory.com", roleKeys: ["STORES"], grantedPermissions: ["STORE_VERIFY"] };
    setDc("dc-16", { status: "SECURITY_RETURNED", dcNumber: "DC-16", movementType: "TOOL", isCommercialService: false, items: [] });
    const { submitCustodianVerification } = await import("../src/server/dcs/actions");
    const res = await submitCustodianVerification("dc-16", {});
    expect(res.ok).toBe(true);
  });

  it("confirmDcAtVendor now requires DC_DISPATCH, not the universally-granted DC_VIEW - a VENDOR-role user (DC_VIEW only) cannot confirm receipt", async () => {
    currentUser = { id: "u-vendor", email: "vendor@factory.com", roleKeys: ["VENDOR"], grantedPermissions: ["DC_VIEW"] };
    setDc("dc-17", { status: "DISPATCHED", dcNumber: "DC-17" });
    const { confirmDcAtVendor } = await import("../src/server/dcs/actions");
    const res = await confirmDcAtVendor("dc-17");
    expect(res.ok).toBe(false);
  });

  it("confirmDcAtVendor succeeds for a user holding DC_DISPATCH", async () => {
    currentUser = { id: "u-stores", email: "stores@factory.com", roleKeys: ["STORES"], grantedPermissions: ["DC_DISPATCH"] };
    setDc("dc-18", { status: "DISPATCHED", dcNumber: "DC-18" });
    const { confirmDcAtVendor } = await import("../src/server/dcs/actions");
    const res = await confirmDcAtVendor("dc-18");
    expect(res.ok).toBe(true);
  });
});
