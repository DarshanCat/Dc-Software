import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const dcStore = new Map<string, any>();
let dcCounter = 0;

const prismaMock = {
  vendor: {
    findUnique: vi.fn().mockResolvedValue({ id: "vendor-1", vendorName: "Test Vendor", active: true, gstNumber: "29GST1", address: "Addr", addressLine2: null, area: null, city: null, state: null, pincode: null, country: "India" }),
  },
  process: {
    findUnique: vi.fn(),
  },
  deliveryChallan: {
    create: vi.fn(async ({ data }: any) => {
      const id = `dc-${++dcCounter}`;
      const record = { id, ...data };
      dcStore.set(id, record);
      return record;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const existing = dcStore.get(where.id);
      const updated = { ...existing, ...data };
      dcStore.set(where.id, updated);
      return updated;
    }),
    findUnique: vi.fn(async ({ where }: any) => dcStore.get(where.id) ?? null),
  },
  deliveryChallanItem: { create: vi.fn().mockResolvedValue({}) },
  statusHistory: { create: vi.fn().mockResolvedValue({}) },
  auditLog: { create: vi.fn().mockResolvedValue({}) },
  user: { findMany: vi.fn().mockResolvedValue([]) },
  $transaction: vi.fn((arg: any) => (typeof arg === "function" ? arg(prismaMock) : Promise.all(arg))),
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/services/number-sequence.service", () => ({
  nextNumber: vi.fn().mockResolvedValue("DC-2026-TEST"),
  fiscalYearOf: vi.fn().mockReturnValue("2026-27"),
}));
vi.mock("../src/services/dispatch.service", () => ({
  generateQrToken: vi.fn().mockReturnValue("qr-token-test"),
  buildDcQrUrl: vi.fn().mockReturnValue("https://example.com/qr/token"),
}));

const storesUser = { id: "u-stores", email: "stores@factory.com", roleKeys: ["STORES"], vendorId: null };
const managementUser = { id: "u-mgmt", email: "manager@factory.com", roleKeys: ["MANAGEMENT"], vendorId: null };
let currentUser: typeof storesUser = storesUser;
vi.mock("../src/server/session", () => ({ getSessionUser: vi.fn(() => Promise.resolve(currentUser)) }));

const baseMaterialInput = {
  movementType: "MATERIAL" as const,
  vendorId: "vendor-1",
  woNumber: "WO-2026-500",
  partNumber: "PART-500",
  rmQuantity: 100,
  returnFgQuantity: 98,
  heatNumber: "HEAT-500",
  pricingBasis: "RM" as const,
  ratePerQuantity: 10,
  purpose: "JOB_WORK" as const,
  preparedByName: "Stores Tester",
};

describe("Weight (KG) persistence through DRAFT -> PENDING_APPROVAL -> APPROVED", () => {
  beforeEach(() => {
    dcStore.clear();
    dcCounter = 0;
    currentUser = storesUser;
    vi.clearAllMocks();
    prismaMock.vendor.findUnique.mockResolvedValue({ id: "vendor-1", vendorName: "Test Vendor", active: true, gstNumber: "29GST1", address: "Addr", addressLine2: null, area: null, city: null, state: null, pincode: null, country: "India" });
    prismaMock.user.findMany.mockResolvedValue([]);
  });

  it("persists the entered weight to DeliveryChallan.outwardWeight as a Prisma.Decimal on create", async () => {
    const { createDc } = await import("../src/server/dcs/actions");
    const res = await createDc({ ...baseMaterialInput, outwardWeight: 152.75 } as any);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const stored = dcStore.get(res.dcId);
    expect(stored.outwardWeight).toBeInstanceOf(Prisma.Decimal);
    expect(stored.outwardWeight.toString()).toBe("152.75");
  });

  it("multiple DCs created with different weights each keep their own value (no cross-contamination)", async () => {
    const { createDc } = await import("../src/server/dcs/actions");
    const first = await createDc({ ...baseMaterialInput, woNumber: "WO-A", outwardWeight: 10.5 } as any);
    const second = await createDc({ ...baseMaterialInput, woNumber: "WO-B", outwardWeight: 999.125 } as any);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(dcStore.get(first.dcId).outwardWeight.toString()).toBe("10.5");
    expect(dcStore.get(second.dcId).outwardWeight.toString()).toBe("999.125");
  });

  it("survives DRAFT -> PENDING_APPROVAL -> APPROVED unchanged", async () => {
    const { createDc, submitForApproval, approveDc } = await import("../src/server/dcs/actions");

    const created = await createDc({ ...baseMaterialInput, outwardWeight: 47.333 } as any);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(dcStore.get(created.dcId).status).toBe("DRAFT");
    expect(dcStore.get(created.dcId).outwardWeight.toString()).toBe("47.333");

    const submitted = await submitForApproval(created.dcId);
    expect(submitted.ok).toBe(true);
    expect(dcStore.get(created.dcId).status).toBe("PENDING_APPROVAL");
    expect(dcStore.get(created.dcId).outwardWeight.toString()).toBe("47.333");

    currentUser = managementUser;
    const approved = await approveDc(created.dcId, "Manager Name");
    expect(approved.ok).toBe(true);
    expect(dcStore.get(created.dcId).status).toBe("APPROVED");
    expect(dcStore.get(created.dcId).outwardWeight.toString()).toBe("47.333");
  });

  it("submitForApproval and approveDc never include outwardWeight in their update payload (Security/Management cannot alter it)", async () => {
    const { createDc, submitForApproval, approveDc } = await import("../src/server/dcs/actions");
    const created = await createDc({ ...baseMaterialInput, outwardWeight: 5 } as any);
    if (!created.ok) throw new Error("setup failed");

    await submitForApproval(created.dcId);
    currentUser = managementUser;
    await approveDc(created.dcId, "Manager Name");

    for (const call of prismaMock.deliveryChallan.update.mock.calls) {
      const [{ data }] = call;
      expect(data).not.toHaveProperty("outwardWeight");
    }
  });

  it("rejects creation server-side even if a malformed weight somehow bypasses the browser", async () => {
    const { createDc } = await import("../src/server/dcs/actions");
    const res = await createDc({ ...baseMaterialInput, outwardWeight: "abc" } as any);
    expect(res.ok).toBe(false);
  });
});
