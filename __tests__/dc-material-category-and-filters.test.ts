import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const dcStore = new Map<string, any>();
let dcCounter = 0;

const prismaMock = {
  vendor: {
    findUnique: vi.fn().mockResolvedValue({
      id: "vendor-1",
      vendorName: "Precision Castings Ltd",
      active: true,
      gstNumber: "29AABCU9603R1ZM",
      address: "Plot 12, Industrial Area",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
    }),
  },
  process: {
    findUnique: vi.fn().mockResolvedValue({ id: "proc-1", name: "Machining", active: true }),
  },
  itemMaster: {
    findFirst: vi.fn().mockResolvedValue(null),
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
    findUnique: vi.fn(async ({ where }: any) => {
      if (where.id) return dcStore.get(where.id) ?? null;
      if (where.qrToken) {
        for (const record of dcStore.values()) {
          if (record.qrToken === where.qrToken) return record;
        }
      }
      return null;
    }),
    findMany: vi.fn(async ({ where }: any) => {
      let results = Array.from(dcStore.values());
      if (where?.materialCategory) {
        results = results.filter((r) => r.materialCategory === where.materialCategory);
      }
      if (where?.woNumber?.contains) {
        results = results.filter((r) =>
          r.woNumber?.toLowerCase().includes(where.woNumber.contains.toLowerCase())
        );
      }
      return results;
    }),
  },
  deliveryChallanItem: { create: vi.fn().mockResolvedValue({}) },
  statusHistory: { create: vi.fn().mockResolvedValue({}) },
  auditLog: { create: vi.fn().mockResolvedValue({}) },
  user: { findMany: vi.fn().mockResolvedValue([]) },
  $transaction: vi.fn((arg: any) => (typeof arg === "function" ? arg(prismaMock) : Promise.all(arg))),
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/server/authorize", () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: "u-1" }),
  hasPermission: vi.fn().mockResolvedValue(true),
  ForbiddenError: class extends Error {},
  UnauthenticatedError: class extends Error {},
}));
vi.mock("../src/server/session", () => ({
  getSessionUser: vi.fn().mockResolvedValue({
    id: "user-stores-1",
    email: "stores@factory.com",
    roleKeys: ["STORES"],
  }),
}));
vi.mock("../src/services/number-sequence.service", () => ({
  nextNumber: vi.fn().mockResolvedValue("DC-2026-000100"),
  fiscalYearOf: vi.fn().mockReturnValue("2026-27"),
}));

describe("Material Category (Production vs Conversion) and Flow Filter Suite", () => {
  beforeEach(() => {
    dcStore.clear();
    dcCounter = 0;
    vi.clearAllMocks();
  });

  it("1. creates DC with materialCategory = 'CONVERSION'", async () => {
    const { createDc } = await import("@/server/dcs/actions");
    const res = await createDc({
      movementType: "MATERIAL",
      isCommercialService: false,
      dimensionUom: "MM",
      vendorId: "vendor-1",
      woNumber: "WO-2026-CONV-10",
      partNumber: "PART-CONV-01",
      heatNumber: "HEAT-888",
      materialGrade: "SG 500/7",
      materialCategory: "CONVERSION",
      rmQuantity: 200,
      returnFgQuantity: 195,
      outwardWeight: 65.5,
      length: 120,
      width: 80,
      height: 45,
      pricingBasis: "RM",
      ratePerQuantity: 50,
      purpose: "JOB_WORK",
      preparedByName: "Stores Operator",
    });

    expect(res.ok).toBe(true);
    if (!res.ok || !res.dcId) return;

    const stored = dcStore.get(res.dcId);
    expect(stored.materialCategory).toBe("CONVERSION");
    expect(stored.woNumber).toBe("WO-2026-CONV-10");
  });

  it("2. defaults materialCategory to 'PRODUCTION' when not specified", async () => {
    const { createDc } = await import("@/server/dcs/actions");
    const res = await createDc({
      movementType: "MATERIAL",
      isCommercialService: false,
      dimensionUom: "MM",
      vendorId: "vendor-1",
      woNumber: "WO-2026-PROD-20",
      partNumber: "PART-PROD-01",
      heatNumber: "HEAT-999",
      materialGrade: "EN-GJS-500-7",
      rmQuantity: 500,
      returnFgQuantity: 490,
      outwardWeight: 120,
      length: 150,
      width: 100,
      height: 60,
      pricingBasis: "FG",
      ratePerQuantity: 75,
      purpose: "JOB_WORK",
      preparedByName: "Stores Operator",
    });

    expect(res.ok).toBe(true);
    if (!res.ok || !res.dcId) return;

    const stored = dcStore.get(res.dcId);
    expect(stored.materialCategory).toBe("PRODUCTION");
  });

  it("3. creates Outward DC with materialCategory = 'CONVERSION'", async () => {
    const { createOutwardDc } = await import("@/server/dcs/extended-actions");
    const res = await createOutwardDc({
      vendorId: "vendor-1",
      department: "PRODUCTION",
      woNumber: "WO-OUT-CONV-01",
      partNumber: "PN-CONV-99",
      materialGrade: "GG 25",
      materialCategory: "CONVERSION",
      pricingBasis: "RW",
      ratePerQuantity: 40,
      outwardWeight: 35.5,
      outwardQtyRw: 150,
      returningFgQuantity: 145,
      length: 200,
      width: 150,
      height: 80,
    });

    expect(res.ok).toBe(true);
    if (!res.ok || !res.dcId) return;

    const stored = dcStore.get(res.dcId);
    expect(stored.materialCategory).toBe("CONVERSION");
  });

  it("4. updates Outward DC and preserves or changes materialCategory", async () => {
    const { createOutwardDc, updateOutwardDc } = await import("@/server/dcs/extended-actions");
    const created = await createOutwardDc({
      vendorId: "vendor-1",
      department: "PRODUCTION",
      woNumber: "WO-EDIT-01",
      partNumber: "PN-INITIAL",
      materialGrade: "FG 260",
      materialCategory: "PRODUCTION",
      pricingBasis: "RW",
      ratePerQuantity: 30,
      outwardWeight: 50,
      outwardQtyRw: 80,
      returningFgQuantity: 75,
      length: 120,
      width: 80,
      height: 40,
    });

    expect(created.ok).toBe(true);
    if (!created.ok || !created.dcId) return;

    // Update to CONVERSION
    const updated = await updateOutwardDc({
      dcId: created.dcId,
      vendorId: "vendor-1",
      department: "PRODUCTION",
      woNumber: "WO-EDIT-01",
      partNumber: "PN-INITIAL",
      materialGrade: "FG 260",
      materialCategory: "CONVERSION",
      pricingBasis: "RW",
      ratePerQuantity: 35,
      outwardWeight: 50,
      outwardQtyRw: 80,
      returningFgQuantity: 75,
    });

    expect(updated.ok).toBe(true);
    const stored = dcStore.get(created.dcId);
    expect(stored.materialCategory).toBe("CONVERSION");
  });

  it("5. builds valid public QR softcopy URLs that never contain localhost", async () => {
    const { buildDcPublicUrl } = await import("@/services/dispatch.service");
    const url = buildDcPublicUrl("secure-qr-token-abc");
    expect(url).toBe("https://dc.vijayspheroidals.in/qr/secure-qr-token-abc");
    expect(url).not.toContain("localhost");
  });
});
