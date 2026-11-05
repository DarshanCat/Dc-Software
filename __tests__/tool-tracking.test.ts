import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  deliveryChallan: { findMany: vi.fn() },
  toolInstance: { findMany: vi.fn() },
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));

function makeDc(overrides: Record<string, any>) {
  return {
    id: "dc-1",
    dcNumber: "DC-TOOL-001",
    dcDate: new Date("2026-10-01"),
    vendorId: "v-1",
    vendor: { vendorName: "Vendor A" },
    supplierNameSnapshot: null,
    status: "DISPATCHED",
    expectedReturnDate: new Date("2026-11-01"),
    securityDispatchedAt: new Date("2026-10-02"),
    outwardDate: new Date("2026-10-01"),
    items: [],
    ...overrides,
  };
}

describe("getToolsWithVendor - which Tool DCs count as 'with the vendor'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.toolInstance.findMany.mockResolvedValue([
      { id: "ti-1", serialNumber: "SN-100", toolMaster: { toolCode: "TL-001", toolName: "Vernier Caliper" } },
    ]);
  });

  it("includes a DISPATCHED Tool DC's serialized item", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([
      makeDc({
        status: "DISPATCHED",
        items: [{ itemCode: null, itemDescription: "Vernier Caliper", quantity: 2, uom: "NOS", conditionIn: "GOOD", toolInstanceId: "ti-1" }],
      }),
    ]);

    const { getToolsWithVendor } = await import("../src/server/reports/tool-tracking");
    const rows = await getToolsWithVendor();

    expect(rows).toHaveLength(1);
    expect(rows[0].toolCode).toBe("TL-001");
    expect(rows[0].serialNumber).toBe("SN-100");
    expect(rows[0].vendorName).toBe("Vendor A");
    expect(rows[0].quantity).toBe(2);
  });

  it("excludes a line item with no toolInstanceId (not an identifiable serialized tool)", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([
      makeDc({ items: [{ itemCode: "MISC", itemDescription: "Generic consumable", quantity: 5, uom: "NOS", conditionIn: null, toolInstanceId: null }] }),
    ]);

    const { getToolsWithVendor } = await import("../src/server/reports/tool-tracking");
    const rows = await getToolsWithVendor();

    expect(rows).toHaveLength(0);
  });

  it("only queries DISPATCHED/AT_VENDOR Tool DCs - never DRAFT, PENDING_APPROVAL, or returned statuses", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([]);

    const { getToolsWithVendor } = await import("../src/server/reports/tool-tracking");
    await getToolsWithVendor();

    const call = prismaMock.deliveryChallan.findMany.mock.calls[0][0];
    expect(call.where.movementType).toBe("TOOL");
    expect(call.where.status.in.sort()).toEqual(["AT_VENDOR", "DISPATCHED"]);
  });

  it("filters by vendorId when provided", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([]);

    const { getToolsWithVendor } = await import("../src/server/reports/tool-tracking");
    await getToolsWithVendor({ vendorId: "v-42" });

    const call = prismaMock.deliveryChallan.findMany.mock.calls[0][0];
    expect(call.where.vendorId).toBe("v-42");
  });

  it("computes daysOut from the dispatch timestamp", async () => {
    const dispatchedAt = new Date(Date.now() - 5 * 86_400_000);
    prismaMock.deliveryChallan.findMany.mockResolvedValue([
      makeDc({
        securityDispatchedAt: dispatchedAt,
        items: [{ itemCode: null, itemDescription: "Caliper", quantity: 1, uom: "NOS", conditionIn: "GOOD", toolInstanceId: "ti-1" }],
      }),
    ]);

    const { getToolsWithVendor } = await import("../src/server/reports/tool-tracking");
    const rows = await getToolsWithVendor();

    expect(rows[0].daysOut).toBe(5);
  });
});

describe("summarizeByVendor", () => {
  it("aggregates tool quantity per vendor", async () => {
    const { summarizeByVendor } = await import("../src/server/reports/tool-tracking");
    const rows = [
      { dcId: "dc-1", dcNumber: "DC-1", dcDate: new Date(), vendorId: "v-1", vendorName: "Vendor A", toolCode: "T1", toolName: "T1", serialNumber: "S1", quantity: 2, uom: "NOS", conditionOut: null, dispatchedAt: null, expectedReturnDate: null, status: "DISPATCHED", daysOut: null },
      { dcId: "dc-2", dcNumber: "DC-2", dcDate: new Date(), vendorId: "v-1", vendorName: "Vendor A", toolCode: "T2", toolName: "T2", serialNumber: "S2", quantity: 3, uom: "NOS", conditionOut: null, dispatchedAt: null, expectedReturnDate: null, status: "DISPATCHED", daysOut: null },
      { dcId: "dc-3", dcNumber: "DC-3", dcDate: new Date(), vendorId: "v-2", vendorName: "Vendor B", toolCode: "T3", toolName: "T3", serialNumber: "S3", quantity: 1, uom: "NOS", conditionOut: null, dispatchedAt: null, expectedReturnDate: null, status: "DISPATCHED", daysOut: null },
    ];

    const summary = summarizeByVendor(rows);

    expect(summary).toEqual([
      { vendorId: "v-1", vendorName: "Vendor A", toolCount: 5 },
      { vendorId: "v-2", vendorName: "Vendor B", toolCount: 1 },
    ]);
  });
});

describe("toolTrackingRowsToCsv", () => {
  it("escapes a CSV-formula-injection attempt in a free-text field", async () => {
    const { toolTrackingRowsToCsv } = await import("../src/server/reports/tool-tracking");
    const csv = toolTrackingRowsToCsv([
      { dcId: "dc-1", dcNumber: "DC-1", dcDate: new Date("2026-10-01"), vendorId: "v-1", vendorName: "=cmd|'/c calc'", toolCode: "T1", toolName: "T1", serialNumber: "S1", quantity: 1, uom: "NOS", conditionOut: "GOOD", dispatchedAt: null, expectedReturnDate: null, status: "DISPATCHED", daysOut: 3 },
    ]);
    expect(csv).toContain("'=cmd");
  });

  it("produces a header row plus one row per tool", async () => {
    const { toolTrackingRowsToCsv } = await import("../src/server/reports/tool-tracking");
    const csv = toolTrackingRowsToCsv([
      { dcId: "dc-1", dcNumber: "DC-1", dcDate: new Date("2026-10-01"), vendorId: "v-1", vendorName: "Vendor A", toolCode: "T1", toolName: "Caliper", serialNumber: "S1", quantity: 1, uom: "NOS", conditionOut: "GOOD", dispatchedAt: null, expectedReturnDate: null, status: "DISPATCHED", daysOut: 3 },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("DC Number");
  });
});
