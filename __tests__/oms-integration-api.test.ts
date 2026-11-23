import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";
import { GET } from "@/app/api/integrations/oms/dcs/route";
import { middleware } from "@/middleware";
import {
  buildOmsDcWhere,
  computeExpectedReturnDate,
  decimalToNumber,
  isValidOmsToken,
  mapDcForOms,
  parseOpenOnly,
  parseWoNumbers,
  type OmsDcRow,
} from "@/services/oms-integration.service";

vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryChallan: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

const TOKEN = "test-oms-token-0123456789abcdef";
const URL_BASE = "http://localhost:3000/api/integrations/oms/dcs";

function req(query = "", token: string | null = TOKEN) {
  const headers: Record<string, string> = {};
  if (token !== null) headers["x-oms-token"] = token;
  return new NextRequest(`${URL_BASE}${query}`, { headers });
}

function row(overrides: Partial<OmsDcRow> = {}): OmsDcRow {
  return {
    dcNumber: "DC-2026-00001",
    woNumber: "WO-100",
    partNumber: "P-1",
    partNumberSnapshot: null,
    supplierNameSnapshot: "Snapshot Vendor",
    status: "DISPATCHED",
    purpose: "MACHINING",
    rmQuantity: new Prisma.Decimal("100.000"),
    outwardQtyRw: null,
    rmUom: "NOS",
    securityDispatchQuantity: new Prisma.Decimal("98.500"),
    securityDispatchDate: null,
    // 2026-11-20 20:00 UTC = 2026-11-21 01:30 IST
    securityDispatchedAt: new Date("2026-11-20T20:00:00.000Z"),
    dispatchedAt: null,
    securityFgQuantity: null,
    actualInwardQty: null,
    storeReceivedQty: null,
    storeVerifiedFgQuantity: null,
    closedAt: null,
    createdAt: new Date("2026-11-19T10:00:00.000Z"),
    expectedReturnDate: null,
    vendor: { vendorName: "Acme Machining", defaultReturnDays: 7 },
    items: [],
    ...overrides,
  };
}

describe("GET /api/integrations/oms/dcs - auth", () => {
  const original = process.env.OMS_INTEGRATION_TOKEN;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OMS_INTEGRATION_TOKEN = TOKEN;
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([] as never);
  });
  afterEach(() => {
    if (original === undefined) delete process.env.OMS_INTEGRATION_TOKEN;
    else process.env.OMS_INTEGRATION_TOKEN = original;
  });

  it("returns 503 when OMS_INTEGRATION_TOKEN is unset", async () => {
    delete process.env.OMS_INTEGRATION_TOKEN;
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "OMS integration not configured" });
    expect(prisma.deliveryChallan.findMany).not.toHaveBeenCalled();
  });

  it("returns 503 when OMS_INTEGRATION_TOKEN is empty", async () => {
    process.env.OMS_INTEGRATION_TOKEN = "";
    const res = await GET(req("", ""));
    expect(res.status).toBe(503);
  });

  it("returns 401 when the token header is missing", async () => {
    const res = await GET(req("", null));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(prisma.deliveryChallan.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong token (same and different length)", async () => {
    for (const bad of ["x", TOKEN.slice(0, -1) + "X", TOKEN + "extra"]) {
      const res = await GET(req("", bad));
      expect(res.status).toBe(401);
    }
    expect(prisma.deliveryChallan.findMany).not.toHaveBeenCalled();
  });

  it("isValidOmsToken is exact-match only", () => {
    expect(isValidOmsToken(TOKEN, TOKEN)).toBe(true);
    expect(isValidOmsToken(TOKEN.toUpperCase(), TOKEN)).toBe(false);
    expect(isValidOmsToken(null, TOKEN)).toBe(false);
    expect(isValidOmsToken(TOKEN, "")).toBe(false);
  });
});

describe("GET /api/integrations/oms/dcs - query and response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OMS_INTEGRATION_TOKEN = TOKEN;
  });

  it("returns 200 with the exact contract shape", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([row()] as never);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["dcs", "generatedAt"]);
    expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);
    expect(body.dcs).toEqual([
      {
        dcNumber: "DC-2026-00001",
        woNumber: "WO-100",
        partNumber: "P-1",
        vendorName: "Acme Machining",
        status: "DISPATCHED",
        purpose: "MACHINING",
        quantitySent: 98.5,
        unit: "NOS",
        sentAt: "2026-11-20T20:00:00.000Z",
        expectedReturnDate: "2026-11-28", // IST day 2026-11-21 + 7
        quantityReturned: null,
        closed: false,
      },
    ]);
  });

  it("queries with take 500, sentAt/createdAt desc ordering and a narrow select (no prices / personal data)", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([] as never);
    await GET(req());
    const args = vi.mocked(prisma.deliveryChallan.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(500);
    expect(args.orderBy).toEqual([
      { securityDispatchedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ]);
    const selected = Object.keys(args.select);
    for (const forbidden of [
      "ratePerQuantity", "pricingSnapshot", "expectedAmount", "invoiceAmount", "finalPayableAmount",
      "createdBy", "preparedByName", "approvedByName", "securityDispatchedBy", "supplierGstSnapshot",
      "supplierAddressSnapshot",
    ]) {
      expect(selected).not.toContain(forbidden);
    }
    expect(Object.keys(args.select.vendor.select).sort()).toEqual(["defaultReturnDays", "vendorName"]);
  });

  it("filters by woNumber (repeated and comma-separated, trimmed)", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([] as never);
    await GET(req("?woNumber=WO-1,%20WO-2%20&woNumber=WO-3&woNumber=&woNumber=WO-1"));
    const args = vi.mocked(prisma.deliveryChallan.findMany).mock.calls[0][0] as any;
    expect(args.where.woNumber).toEqual({ in: ["WO-1", "WO-2", "WO-3"] });
  });

  it("applies no woNumber filter when none given", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([] as never);
    await GET(req());
    const args = vi.mocked(prisma.deliveryChallan.findMany).mock.calls[0][0] as any;
    expect(args.where.woNumber).toBeUndefined();
  });

  it("caps woNumber values at 200", () => {
    const many = Array.from({ length: 250 }, (_, i) => `WO-${i}`).join(",");
    expect(parseWoNumbers([many])).toHaveLength(200);
  });

  it("openOnly defaults to true: excludes CANCELLED, CLOSED, REJECTED and closed/cancelled timestamps", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([] as never);
    await GET(req());
    const args = vi.mocked(prisma.deliveryChallan.findMany).mock.calls[0][0] as any;
    expect(args.where.status.notIn.sort()).toEqual(["CANCELLED", "CLOSED", "REJECTED"]);
    expect(args.where.cancelledAt).toBeNull();
    expect(args.where.closedAt).toBeNull();
  });

  it("openOnly=false still excludes cancelled DCs but includes closed ones", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([
      row({ status: "CLOSED", closedAt: new Date("2026-11-22T00:00:00Z") }),
    ] as never);
    const res = await GET(req("?openOnly=false"));
    const args = vi.mocked(prisma.deliveryChallan.findMany).mock.calls[0][0] as any;
    expect(args.where.status.notIn).toEqual(["CANCELLED"]);
    expect(args.where.cancelledAt).toBeNull();
    expect(args.where.closedAt).toBeUndefined();
    const body = await res.json();
    expect(body.dcs[0].closed).toBe(true);
  });

  it("parseOpenOnly treats anything but false/0/no as true", () => {
    expect(parseOpenOnly(null)).toBe(true);
    expect(parseOpenOnly("true")).toBe(true);
    expect(parseOpenOnly("FALSE")).toBe(false);
    expect(parseOpenOnly("0")).toBe(false);
    expect(buildOmsDcWhere({ woNumbers: [], openOnly: true }).closedAt).toBeNull();
  });

  it("returns 500 without leaking details when the query fails", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockRejectedValue(new Error("db secret details"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    spy.mockRestore();
  });
});

describe("OMS mapping - expectedReturnDate", () => {
  it("prefers the return date entered on the DC over the vendor default", () => {
    // 2026-12-01 20:00 UTC = 2026-12-02 01:30 IST
    const m = mapDcForOms(row({ expectedReturnDate: new Date("2026-12-01T20:00:00.000Z") }));
    expect(m.expectedReturnDate).toBe("2026-12-02");
  });

  it("adds vendor.defaultReturnDays to the IST calendar day of sentAt", () => {
    // 2026-11-20 20:00 UTC is already 2026-11-21 in IST
    expect(computeExpectedReturnDate(new Date("2026-11-20T20:00:00Z"), 7)).toBe("2026-11-28");
    // 2026-11-20 10:00 UTC is 2026-11-20 15:30 IST
    expect(computeExpectedReturnDate(new Date("2026-11-20T10:00:00Z"), 7)).toBe("2026-11-27");
  });

  it("defaults to 15 days when the vendor or its days are missing", () => {
    const sent = new Date("2026-11-20T10:00:00Z");
    expect(computeExpectedReturnDate(sent, null)).toBe("2026-12-05");
    expect(computeExpectedReturnDate(sent, undefined)).toBe("2026-12-05");
    expect(mapDcForOms(row({ securityDispatchedAt: sent, vendor: null })).expectedReturnDate).toBe("2026-12-05");
    expect(mapDcForOms(row({ securityDispatchedAt: sent, vendor: null })).vendorName).toBe("Snapshot Vendor");
  });

  it("crosses month/year boundaries correctly", () => {
    expect(computeExpectedReturnDate(new Date("2026-12-25T06:00:00Z"), 15)).toBe("2027-01-09");
  });

  it("is null when sentAt is unknown (not yet dispatched)", () => {
    const m = mapDcForOms(row({ status: "APPROVED", securityDispatchedAt: null, securityDispatchQuantity: null }));
    expect(m.sentAt).toBeNull();
    expect(m.expectedReturnDate).toBeNull();
    expect(m.quantitySent).toBe(100); // falls back to rmQuantity
  });

  it("falls back to securityDispatchDate for sentAt", () => {
    const m = mapDcForOms(row({ securityDispatchedAt: null, securityDispatchDate: new Date("2026-11-01T00:00:00Z") }));
    expect(m.sentAt).toBe("2026-11-01T00:00:00.000Z");
    expect(m.expectedReturnDate).toBe("2026-11-08");
  });
});

describe("OMS mapping - quantities and Decimal conversion", () => {
  it("converts Prisma Decimal, strings and numbers to plain numbers", () => {
    expect(decimalToNumber(new Prisma.Decimal("12.345"))).toBe(12.345);
    expect(decimalToNumber("7.5")).toBe(7.5);
    expect(decimalToNumber(3)).toBe(3);
    expect(decimalToNumber(null)).toBeNull();
    expect(decimalToNumber("abc")).toBeNull();
  });

  it("quantitySent prefers security dispatch qty, then outwardQtyRw, rmQuantity, item sum", () => {
    expect(mapDcForOms(row()).quantitySent).toBe(98.5);
    expect(mapDcForOms(row({ securityDispatchQuantity: null, outwardQtyRw: new Prisma.Decimal("60") })).quantitySent).toBe(60);
    const itemsOnly = mapDcForOms(row({
      securityDispatchQuantity: null,
      rmQuantity: null,
      rmUom: null,
      items: [
        { quantity: new Prisma.Decimal("2.5"), uom: "PCS" },
        { quantity: new Prisma.Decimal("1.5"), uom: "PCS" },
      ],
    }));
    expect(itemsOnly.quantitySent).toBe(4);
    expect(itemsOnly.unit).toBe("PCS");
  });

  it("unit is null when there is no rmUom and items have mixed UOMs", () => {
    const m = mapDcForOms(row({ rmUom: null, items: [{ quantity: 1, uom: "PCS" }, { quantity: 1, uom: "KGS" }] }));
    expect(m.unit).toBeNull();
  });

  it("quantityReturned prefers store-verified FG, then store received, then security inward", () => {
    expect(mapDcForOms(row()).quantityReturned).toBeNull();
    expect(mapDcForOms(row({ securityFgQuantity: new Prisma.Decimal("90") })).quantityReturned).toBe(90);
    expect(mapDcForOms(row({
      securityFgQuantity: new Prisma.Decimal("90"),
      actualInwardQty: new Prisma.Decimal("91"),
      storeReceivedQty: new Prisma.Decimal("89"),
      storeVerifiedFgQuantity: new Prisma.Decimal("88.25"),
    })).quantityReturned).toBe(88.25);
  });

  it("partNumber falls back to the snapshot and closed reflects terminal status", () => {
    expect(mapDcForOms(row({ partNumber: null, partNumberSnapshot: "SNAP-1" })).partNumber).toBe("SNAP-1");
    expect(mapDcForOms(row({ status: "REJECTED" })).closed).toBe(true);
    expect(mapDcForOms(row({ status: "AT_VENDOR" })).closed).toBe(false);
  });
});

describe("middleware - /api/integrations/* is not session-gated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getToken).mockResolvedValue(null);
  });

  it("passes /api/integrations/oms/dcs through without a session", async () => {
    const res = await middleware(new NextRequest(URL_BASE));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(getToken).not.toHaveBeenCalled();
  });

  it("still redirects other signed-out API/app paths to /login", async () => {
    for (const path of ["/api/documents/abc", "/dcs", "/api/integrationsX"]) {
      const res = await middleware(new NextRequest(`http://localhost:3000${path}`));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    }
  });
});
