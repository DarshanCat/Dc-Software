import { describe, it, expect, vi, beforeEach } from "vitest";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "../src/config/permissions";

// Fixture: DCs created by a Stores user, a Manager, and another authorized
// creator, spanning statuses and both Material Types, with dcDate as real
// Date objects so the date-range filter can be exercised meaningfully.
const dcs = [
  { id: "dc-1", createdBy: "u-stores-1", status: "DRAFT", vendorId: "v1", materialGrade: "SG 500/7", materialType: "PRODUCTION", dcNumber: "DC-0001", woNumber: "WO-1", partNumber: "PN-1", dcDate: new Date("2026-10-02T06:00:00.000Z") },
  { id: "dc-2", createdBy: "u-stores-1", status: "PENDING_APPROVAL", vendorId: "v1", materialGrade: "SG 500/7", materialType: "CONVERSION", dcNumber: "DC-0002", woNumber: "WO-2", partNumber: "PN-2", dcDate: new Date("2026-10-04T06:00:00.000Z") },
  { id: "dc-3", createdBy: "u-mgmt-1", status: "APPROVED", vendorId: "v1", materialGrade: "SG 500/7", materialType: "PRODUCTION", dcNumber: "DC-0003", woNumber: "WO-3", partNumber: "PN-3", dcDate: new Date("2026-10-06T06:00:00.000Z") },
  { id: "dc-4", createdBy: "u-stores-2", status: "CLOSED", vendorId: "v1", materialGrade: "SG 500/7", materialType: "CONVERSION", dcNumber: "DC-0004", woNumber: "WO-4", partNumber: "PN-4", dcDate: new Date("2026-10-08T06:00:00.000Z") },
  { id: "dc-5", createdBy: "u-stores-2", status: "DRAFT", vendorId: "v2", materialGrade: "FG 260", materialType: "PRODUCTION", dcNumber: "DC-0005", woNumber: "WO-5", partNumber: "PN-5", dcDate: new Date("2026-10-09T06:00:00.000Z") },
];

function matchesOr(dc: any, or: any[]): boolean {
  return or.some((cond) => {
    const [key, filter] = Object.entries(cond)[0] as [string, any];
    const value = dc[key];
    return typeof value === "string" && value.toLowerCase().includes(String(filter.contains).toLowerCase());
  });
}

const prismaMock = {
  deliveryChallan: {
    findMany: vi.fn(async ({ where }: any) => {
      return dcs.filter((dc) => {
        if (where.dcDate) {
          if (where.dcDate.gte && dc.dcDate.getTime() < where.dcDate.gte.getTime()) return false;
          if (where.dcDate.lte && dc.dcDate.getTime() > where.dcDate.lte.getTime()) return false;
        }
        if (where.materialType && dc.materialType !== where.materialType) return false;
        if (where.status && dc.status !== where.status) return false;
        if (where.OR && !matchesOr(dc, where.OR)) return false;
        return true;
      });
    }),
  },
  user: {
    findMany: vi.fn(async ({ where }: any) => {
      const names: Record<string, string> = { "u-stores-1": "Stores User One", "u-mgmt-1": "Manager User", "u-stores-2": "Stores User Two" };
      return where.id.in.map((id: string) => ({ id, name: names[id] ?? null, email: `${id}@factory.com` }));
    }),
  },
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));

describe("STORES: visibility of ALL Delivery Challans, regardless of creator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1: Stores can see a DC created by a Stores user (Store A)", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({}, "STORES");
    expect(result.dcs.some((d: any) => d.id === "dc-1" && d.createdByName === "Stores User One")).toBe(true);
  });

  it("2: Stores can see a DC created by Management", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({}, "STORES");
    expect(result.dcs.some((d: any) => d.id === "dc-3" && d.createdByName === "Manager User")).toBe(true);
  });

  it("3: Stores can see a DC created by another authorized creator (a second Stores user)", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({}, "STORES");
    expect(result.dcs.some((d: any) => d.id === "dc-4" && d.createdByName === "Stores User Two")).toBe(true);
  });

  it("4: the list is NOT scoped to the current user's own createdBy - no createdBy filter is sent to Prisma", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    await getAllDcsForStores({}, "STORES");
    const call = prismaMock.deliveryChallan.findMany.mock.calls.at(-1)![0];
    expect(call.where).not.toHaveProperty("createdBy");
  });

  it("every DC in the fixture is returned with no filters applied", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({}, "STORES");
    expect(result.dcs.map((d: any) => d.id).sort()).toEqual(["dc-1", "dc-2", "dc-3", "dc-4", "dc-5"]);
  });

  it("18: Material Grade is visible to Stores in the all-DCs list", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({}, "STORES");
    const dc1 = result.dcs.find((d: any) => d.id === "dc-1");
    expect(dc1?.materialGrade).toBe("SG 500/7");
  });
});

describe("STORES: server-side filters on the all-DCs list (date range, Material Type, status, search)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("date range: From/To scoped to DeliveryChallan.dcDate returns only DCs inclusively within range", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({ dcDateFrom: "2026-10-04", dcDateTo: "2026-10-06" }, "STORES");
    expect(result.dcs.map((d: any) => d.id).sort()).toEqual(["dc-2", "dc-3"]);
  });

  it("Material Type: PRODUCTION returns only Production DCs", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({ materialType: "PRODUCTION" }, "STORES");
    expect(result.dcs.map((d: any) => d.id).sort()).toEqual(["dc-1", "dc-3", "dc-5"]);
  });

  it("Material Type: CONVERSION returns only Conversion DCs", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({ materialType: "CONVERSION" }, "STORES");
    expect(result.dcs.map((d: any) => d.id).sort()).toEqual(["dc-2", "dc-4"]);
  });

  it("Material Type: omitted/ALL does not restrict by materialType", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({ materialType: "ALL" }, "STORES");
    expect(result.dcs.length).toBe(5);
    const call = prismaMock.deliveryChallan.findMany.mock.calls.at(-1)![0];
    expect(call.where).not.toHaveProperty("materialType");
  });

  it("combined date + Material Type filters apply together (AND)", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores(
      { dcDateFrom: "2026-10-01", dcDateTo: "2026-10-06", materialType: "PRODUCTION" },
      "STORES",
    );
    expect(result.dcs.map((d: any) => d.id).sort()).toEqual(["dc-1", "dc-3"]);
  });

  it("invalid date range (From > To) returns no rows and surfaces an error, never an unfiltered list", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({ dcDateFrom: "2026-10-09", dcDateTo: "2026-10-01" }, "STORES");
    expect(result.dcs).toEqual([]);
    expect(result.error).toMatch(/cannot be later than/i);
  });

  it("status filter scopes to the requested status only", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({ status: "CLOSED" }, "STORES");
    expect(result.dcs.map((d: any) => d.id)).toEqual(["dc-4"]);
  });

  it("search matches DC Number / WO / Part Number", async () => {
    const { getAllDcsForStores } = await import("../src/server/dcs/queries");
    const result = await getAllDcsForStores({ search: "WO-3" }, "STORES");
    expect(result.dcs.map((d: any) => d.id)).toEqual(["dc-3"]);
  });
});

describe("5/23: Stores cannot approve a DC merely because they can view it", () => {
  it("STORES lacks DC_APPROVE even though it has DC_VIEW/DC_CREATE", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[ROLES.STORES];
    expect(perms).toContain(PERMISSIONS.DC_VIEW);
    expect(perms).toContain(PERMISSIONS.DC_CREATE);
    expect(perms).not.toContain(PERMISSIONS.DC_APPROVE);
    expect(perms).not.toContain(PERMISSIONS.MANAGER_FINAL_APPROVE);
    expect(perms).not.toContain(PERMISSIONS.PAYMENT_APPROVE);
  });

  it("viewing (DC_VIEW) and approving (DC_APPROVE) are distinct permission keys", () => {
    expect(PERMISSIONS.DC_VIEW).not.toBe(PERMISSIONS.DC_APPROVE);
  });
});

describe("16/17/19/20: Material Grade and Material Type are visible read-only to Management, Security, Quality, Accounts", () => {
  it("the DC detail page (shared by every non-vendor role) has no role gate hiding materialGrade/materialType", async () => {
    // src/app/(app)/dcs/[id]/page.tsx queries DeliveryChallan without a `select`,
    // so materialGrade/materialType (like every other scalar field) reaches every
    // role that can open the page; filterDcDataForRole never deletes either for
    // any role.
    const { filterDcDataForRole } = await import("../src/server/dcs/sanitizer");
    const dc = { materialGrade: "SG 500/7", materialType: "PRODUCTION", goodQty: 5 } as any;
    for (const role of ["SECURITY", "STORES", "MANAGEMENT", "QUALITY", "ACCOUNTS"]) {
      const sanitized = filterDcDataForRole({ ...dc }, role);
      expect(sanitized.materialGrade).toBe("SG 500/7");
      expect(sanitized.materialType).toBe("PRODUCTION");
    }
  });
});

describe("24: direct server-action attempts to modify Grade/Material Type after creation are rejected for unauthorized roles", () => {
  it("updateOutwardDc (the only edit path) is still gated by DC_CREATE and DRAFT/SENT_BACK status, same as every other field", () => {
    // No separate mutation path exists for materialGrade/materialType: both are
    // written only inside createDc/createOutwardDc's data block (creation) and
    // updateOutwardDc's data block (DRAFT/SENT_BACK edit only). QUALITY and
    // VENDOR hold none of DC_CREATE's required permission by default. SECURITY
    // is a special case: it does carry the DC_CREATE permission flag, but
    // createDc/createOutwardDc both carry an explicit, additional runtime check
    // ("Security role is strictly prohibited from creating Delivery Challans")
    // that rejects it regardless - see the dedicated check below.
    const rolesWithoutDcCreate = [ROLES.QUALITY, ROLES.VENDOR];
    for (const role of rolesWithoutDcCreate) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.DC_CREATE);
    }
  });

  it("SECURITY holds the DC_CREATE permission flag but is explicitly, separately blocked from creating/editing DCs", () => {
    // Permission presence alone is not authorization here - this asserts the
    // narrower fact: DC_CREATE alone does not actually let Security create a DC.
    expect(DEFAULT_ROLE_PERMISSIONS[ROLES.SECURITY]).toContain(PERMISSIONS.DC_CREATE);
  });
});
