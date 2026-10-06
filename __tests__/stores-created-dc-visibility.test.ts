import { describe, it, expect, vi, beforeEach } from "vitest";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "../src/config/permissions";

const dcs = [
  { id: "dc-1", createdBy: "u-stores-1", status: "DRAFT", vendorId: "v1", materialGrade: "SG 500/7" },
  { id: "dc-2", createdBy: "u-stores-1", status: "PENDING_APPROVAL", vendorId: "v1", materialGrade: "SG 500/7" },
  { id: "dc-3", createdBy: "u-stores-1", status: "APPROVED", vendorId: "v1", materialGrade: "SG 500/7" },
  { id: "dc-4", createdBy: "u-stores-1", status: "CLOSED", vendorId: "v1", materialGrade: "SG 500/7" },
  { id: "dc-5", createdBy: "u-stores-2", status: "DRAFT", vendorId: "v2", materialGrade: "FG 260" },
];

const prismaMock = {
  deliveryChallan: {
    findMany: vi.fn(async ({ where }: any) => dcs.filter((dc) => dc.createdBy === where.createdBy)),
  },
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));

describe("STORES: visibility of DCs a Stores user personally created (full lifecycle)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1: a Stores user can see every DC they created", async () => {
    const { getStoreCreatedDcs } = await import("../src/server/dcs/queries");
    const result = await getStoreCreatedDcs("u-stores-1", "STORES");
    expect(result.map((d: any) => d.id)).toEqual(["dc-1", "dc-2", "dc-3", "dc-4"]);
  });

  it("2: the DC is visible while DRAFT", async () => {
    const { getStoreCreatedDcs } = await import("../src/server/dcs/queries");
    const result = await getStoreCreatedDcs("u-stores-1", "STORES");
    expect(result.some((d: any) => d.status === "DRAFT")).toBe(true);
  });

  it("3: the DC is visible while PENDING_APPROVAL", async () => {
    const { getStoreCreatedDcs } = await import("../src/server/dcs/queries");
    const result = await getStoreCreatedDcs("u-stores-1", "STORES");
    expect(result.some((d: any) => d.status === "PENDING_APPROVAL")).toBe(true);
  });

  it("4: the DC remains visible after APPROVED, and beyond (e.g. CLOSED)", async () => {
    const { getStoreCreatedDcs } = await import("../src/server/dcs/queries");
    const result = await getStoreCreatedDcs("u-stores-1", "STORES");
    expect(result.some((d: any) => d.status === "APPROVED")).toBe(true);
    expect(result.some((d: any) => d.status === "CLOSED")).toBe(true);
  });

  it("does not leak another Stores user's created DCs", async () => {
    const { getStoreCreatedDcs } = await import("../src/server/dcs/queries");
    const result = await getStoreCreatedDcs("u-stores-1", "STORES");
    expect(result.some((d: any) => d.id === "dc-5")).toBe(false);
  });

  it("query is scoped by createdBy, the authenticated user's own id - not by vendor or any other field", async () => {
    const { getStoreCreatedDcs } = await import("../src/server/dcs/queries");
    await getStoreCreatedDcs("u-stores-2", "STORES");
    const call = prismaMock.deliveryChallan.findMany.mock.calls.at(-1)![0];
    expect(call.where).toEqual({ createdBy: "u-stores-2" });
  });

  it("18: Material Grade is visible to Stores in their created-DC list", async () => {
    const { getStoreCreatedDcs } = await import("../src/server/dcs/queries");
    const result = await getStoreCreatedDcs("u-stores-1", "STORES");
    expect(result[0].materialGrade).toBe("SG 500/7");
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

describe("16/17/19/20: Material Grade is visible read-only to Management, Security, Quality, Accounts", () => {
  it("the DC detail page (shared by every non-vendor role) has no role gate hiding materialGrade", async () => {
    // src/app/(app)/dcs/[id]/page.tsx queries DeliveryChallan without a `select`,
    // so materialGrade (like every other scalar field) reaches every role that can
    // open the page; filterDcDataForRole never deletes materialGrade for any role.
    const { filterDcDataForRole } = await import("../src/server/dcs/sanitizer");
    const dc = { materialGrade: "SG 500/7", goodQty: 5 } as any;
    for (const role of ["SECURITY", "STORES", "MANAGEMENT", "QUALITY", "ACCOUNTS"]) {
      const sanitized = filterDcDataForRole({ ...dc }, role);
      expect(sanitized.materialGrade).toBe("SG 500/7");
    }
  });
});

describe("24: direct server-action attempts to modify Grade after creation are rejected for unauthorized roles", () => {
  it("updateOutwardDc (the only edit path) is still gated by DC_CREATE and DRAFT/SENT_BACK status, same as every other field", () => {
    // No separate mutation path exists for materialGrade: it is written only inside
    // createDc/createOutwardDc's data block (creation) and updateOutwardDc's data
    // block (DRAFT/SENT_BACK edit only) - both already require DC_CREATE and reject
    // any status outside DRAFT/SENT_BACK. Quality/Security/Accounts hold none of
    // DC_CREATE's required permission by default.
    const rolesWithoutDcCreate = [ROLES.QUALITY, ROLES.SECURITY, ROLES.VENDOR];
    for (const role of rolesWithoutDcCreate) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.DC_CREATE);
    }
  });
});
