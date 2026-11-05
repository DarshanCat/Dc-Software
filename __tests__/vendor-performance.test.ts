import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  vendor: { findMany: vi.fn() },
  deliveryChallan: { findMany: vi.fn() },
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));

const vendorA = { id: "v-1", vendorCode: "V001", vendorName: "Vendor A", active: true };

function makeDc(overrides: Record<string, any>) {
  return {
    vendorId: "v-1",
    status: "CLOSED",
    dispatch: { id: "dispatch-1" },
    reconciliation: null,
    expectedReturnDate: null,
    expectedScrap: 0,
    receipts: [],
    scrapReceipts: [],
    ...overrides,
  };
}

describe("getVendorPerformanceRows - Return Timeliness eligibility (the page/export drift bug)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.vendor.findMany.mockResolvedValue([vendorA]);
  });

  it("a DRAFT DC with a stray receipt is NOT eligible for Return Timeliness (must be fully-returned-onward AND dispatched)", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([
      makeDc({
        status: "DRAFT",
        dispatch: null,
        expectedReturnDate: new Date("2026-01-10"),
        receipts: [{ receiptDate: new Date("2026-01-05"), items: [] }],
      }),
    ]);

    const { getVendorPerformanceRows } = await import("../src/server/reports/vendor-performance");
    const rows = await getVendorPerformanceRows({ wReturn: 25, wRecon: 25, wScrap: 25, wQuality: 25 });

    // Not eligible -> no timeliness data -> score is null, not corrupted by a mid-pipeline DC.
    expect(rows[0].returnTimelinessScore).toBeNull();
  });

  it("a DC without a dispatch record is NOT eligible even if its status is fully-returned-onward", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([
      makeDc({
        status: "CLOSED",
        dispatch: null,
        expectedReturnDate: new Date("2026-01-10"),
        receipts: [{ receiptDate: new Date("2026-01-05"), items: [] }],
      }),
    ]);

    const { getVendorPerformanceRows } = await import("../src/server/reports/vendor-performance");
    const rows = await getVendorPerformanceRows({ wReturn: 25, wRecon: 25, wScrap: 25, wQuality: 25 });

    expect(rows[0].returnTimelinessScore).toBeNull();
  });

  it("a fully-returned, dispatched DC with a receipt IS eligible and scores on-time correctly", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([
      makeDc({
        status: "CLOSED",
        dispatch: { id: "dispatch-1" },
        expectedReturnDate: new Date("2026-01-10"),
        receipts: [{ receiptDate: new Date("2026-01-05"), items: [] }],
      }),
    ]);

    const { getVendorPerformanceRows } = await import("../src/server/reports/vendor-performance");
    const rows = await getVendorPerformanceRows({ wReturn: 25, wRecon: 25, wScrap: 25, wQuality: 25 });

    expect(rows[0].returnTimelinessScore).toBe(100);
  });

  it("a fully-returned, dispatched DC received AFTER expectedReturnDate scores as late (0%)", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([
      makeDc({
        status: "RECONCILED",
        dispatch: { id: "dispatch-1" },
        expectedReturnDate: new Date("2026-01-01"),
        receipts: [{ receiptDate: new Date("2026-01-10"), items: [] }],
      }),
    ]);

    const { getVendorPerformanceRows } = await import("../src/server/reports/vendor-performance");
    const rows = await getVendorPerformanceRows({ wReturn: 25, wRecon: 25, wScrap: 25, wQuality: 25 });

    expect(rows[0].returnTimelinessScore).toBe(0);
  });

  it("the on-screen report and the CSV export now share the exact same eligibility logic (no drift possible)", async () => {
    // Both page.tsx and export/route.ts import getVendorPerformanceRows from the
    // same module - this is a structural guard against the two re-diverging.
    const pageSrc = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/app/(app)/reports/vendor-performance/page.tsx", import.meta.url), "utf8"),
    );
    const exportSrc = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/app/(app)/reports/vendor-performance/export/route.ts", import.meta.url), "utf8"),
    );
    expect(pageSrc).toContain('from "@/server/reports/vendor-performance"');
    expect(exportSrc).toContain('from "@/server/reports/vendor-performance"');
    // Neither file re-implements the eligibility condition independently.
    expect(pageSrc).not.toContain("FULLY_RETURNED_ONWARD");
    expect(exportSrc).not.toContain("FULLY_RETURNED_ONWARD");
  });
});

describe("getVendorPerformanceRows - other scoring dimensions unaffected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.vendor.findMany.mockResolvedValue([vendorA]);
  });

  it("reconciliation score is based on BALANCED/CLOSED reconciliation status regardless of DC status", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([
      makeDc({ reconciliation: { status: "BALANCED" } }),
      makeDc({ reconciliation: { status: "OPEN" } }),
    ]);

    const { getVendorPerformanceRows } = await import("../src/server/reports/vendor-performance");
    const rows = await getVendorPerformanceRows({ wReturn: 25, wRecon: 25, wScrap: 25, wQuality: 25 });

    expect(rows[0].reconciliationScore).toBe(50);
  });

  it("a vendor with zero DCs has every score as null (no divide-by-zero)", async () => {
    prismaMock.deliveryChallan.findMany.mockResolvedValue([]);

    const { getVendorPerformanceRows } = await import("../src/server/reports/vendor-performance");
    const rows = await getVendorPerformanceRows({ wReturn: 25, wRecon: 25, wScrap: 25, wQuality: 25 });

    expect(rows[0].returnTimelinessScore).toBeNull();
    expect(rows[0].reconciliationScore).toBeNull();
    expect(rows[0].scrapRecoveryScore).toBeNull();
    expect(rows[0].qualityScore).toBeNull();
    expect(rows[0].overallScore).toBeNull();
  });
});
