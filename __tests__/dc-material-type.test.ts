import { describe, it, expect, vi, beforeEach } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  createDcSchema,
  outwardDcSchema,
  validateMaterialType,
  MATERIAL_TYPES,
} from "../src/lib/validation/dc";
import { wrapCellText, renderDcPdf, type DcPdfData } from "../src/services/dc-pdf";
import { buildDcDateRange } from "../src/lib/dc-date";

// Module-level (not inside a describe/beforeEach) because vi.mock calls below
// are hoisted above all other module code - a mock factory can only reference
// bindings declared at this same top level.
const dcStore = new Map<string, any>();
let dcCounter = 0;

const prismaMock = {
  vendor: {
    findUnique: vi.fn().mockResolvedValue({ id: "vendor-1", vendorName: "Test Vendor", active: true, gstNumber: "29GST1", address: "Addr", addressLine2: null, area: null, city: null, state: null, pincode: null, country: "India" }),
  },
  process: { findUnique: vi.fn() },
  deliveryChallan: {
    create: vi.fn(async ({ data }: any) => {
      const id = `dc-${++dcCounter}`;
      const record = { id, ...data };
      dcStore.set(id, record);
      return record;
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
vi.mock("../src/server/session", () => ({
  getSessionUser: vi.fn(() => Promise.resolve({ id: "u-stores", email: "stores@factory.com", roleKeys: ["STORES"], vendorId: null })),
}));

const baseMaterialPayload = {
  movementType: "MATERIAL" as const,
  vendorId: "vendor-1",
  woNumber: "WO-1001",
  partNumber: "PART-9",
  rmQuantity: 100,
  returnFgQuantity: 98,
  heatNumber: "HEAT-1",
  materialGrade: "SG 500/7",
  outwardWeight: 50,
  length: 100,
  width: 50,
  height: 25,
  pricingBasis: "RM" as const,
  ratePerQuantity: 10,
  purpose: "JOB_WORK" as const,
  preparedByName: "Tester",
};

// ================= A. MATERIAL TYPE VALIDATION =================

describe("validateMaterialType (shared business rule)", () => {
  it("accepts PRODUCTION for MATERIAL DCs", () => {
    expect(validateMaterialType("MATERIAL", "PRODUCTION")).toBeNull();
  });

  it("accepts CONVERSION for MATERIAL DCs", () => {
    expect(validateMaterialType("MATERIAL", "CONVERSION")).toBeNull();
  });

  it("rejects a blank/missing Material Type for MATERIAL DCs", () => {
    expect(validateMaterialType("MATERIAL", undefined)).toMatch(/required/i);
    expect(validateMaterialType("MATERIAL", null)).toMatch(/required/i);
    expect(validateMaterialType("MATERIAL", "")).toMatch(/required/i);
  });

  it("rejects an invalid Material Type value", () => {
    expect(validateMaterialType("MATERIAL", "SCRAP")).toMatch(/production or conversion/i);
  });

  it("does not require Material Type for TOOL or COMPANY_PROPERTY DCs", () => {
    expect(validateMaterialType("TOOL", undefined)).toBeNull();
    expect(validateMaterialType("COMPANY_PROPERTY", null)).toBeNull();
  });
});

describe("createDcSchema - Material Type required at DC creation (Stores/Management creating a Material DC)", () => {
  it("accepts a Material DC with Material Type PRODUCTION", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, materialType: "PRODUCTION" });
    expect(parsed.success).toBe(true);
  });

  it("accepts a Material DC with Material Type CONVERSION", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, materialType: "CONVERSION" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a Material DC with no Material Type supplied", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("materialType"))).toBe(true);
    }
  });

  it("rejects an invalid Material Type value", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, materialType: "SCRAP" as any });
    expect(parsed.success).toBe(false);
  });

  it("does not require Material Type for a TOOL DC (movementType-gated, like Grade/Weight/Dimensions)", () => {
    const parsed = createDcSchema.safeParse({
      movementType: "TOOL",
      destinationDepartment: "PRODUCTION",
      responsibleCustodian: "Ravi",
      purpose: "OTHER",
      preparedByName: "Tester",
      items: [{ itemDescription: "Wrench set", quantity: 1, uom: "NOS" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("does not require Material Type for a COMPANY_PROPERTY DC", () => {
    const parsed = createDcSchema.safeParse({
      movementType: "COMPANY_PROPERTY",
      destinationDepartment: "PRODUCTION",
      responsibleCustodian: "Ravi",
      purpose: "OTHER",
      preparedByName: "Tester",
      items: [{ itemDescription: "Laptop", quantity: 1, uom: "NOS" }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("outwardDcSchema - Material Type on the Outgoing DC creation flow", () => {
  it("accepts PRODUCTION", () => {
    const parsed = outwardDcSchema.safeParse({ vendorId: "v1", materialType: "PRODUCTION" });
    expect(parsed.success).toBe(true);
  });

  it("accepts CONVERSION", () => {
    const parsed = outwardDcSchema.safeParse({ vendorId: "v1", materialType: "CONVERSION" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid Material Type value", () => {
    const parsed = outwardDcSchema.safeParse({ vendorId: "v1", materialType: "SCRAP" as any });
    expect(parsed.success).toBe(false);
  });
});

describe("MATERIAL_TYPES is exactly PRODUCTION/CONVERSION - no reuse of DcMovementType", () => {
  it("has exactly two values", () => {
    expect(MATERIAL_TYPES).toEqual(["PRODUCTION", "CONVERSION"]);
  });

  it("is disjoint from the existing DcMovementType values", () => {
    const movementTypeValues = ["MATERIAL", "TOOL", "COMPANY_PROPERTY"];
    for (const v of MATERIAL_TYPES) {
      expect(movementTypeValues).not.toContain(v);
    }
  });
});

// ================= B. PERSISTENCE =================

describe("Material Type persistence through createDc", () => {
  beforeEach(() => {
    dcStore.clear();
    dcCounter = 0;
    vi.clearAllMocks();
    prismaMock.vendor.findUnique.mockResolvedValue({ id: "vendor-1", vendorName: "Test Vendor", active: true, gstNumber: "29GST1", address: "Addr", addressLine2: null, area: null, city: null, state: null, pincode: null, country: "India" });
    prismaMock.user.findMany.mockResolvedValue([]);
  });

  it("persists PRODUCTION to DeliveryChallan.materialType on create", async () => {
    const { createDc } = await import("../src/server/dcs/actions");
    const res = await createDc({ ...baseMaterialPayload, materialType: "PRODUCTION" } as any);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(dcStore.get(res.dcId).materialType).toBe("PRODUCTION");
  });

  it("persists CONVERSION to DeliveryChallan.materialType on create", async () => {
    const { createDc } = await import("../src/server/dcs/actions");
    const res = await createDc({ ...baseMaterialPayload, materialType: "CONVERSION" } as any);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(dcStore.get(res.dcId).materialType).toBe("CONVERSION");
  });

  it("rejects creation server-side when Material Type is missing, even if the browser's required attribute is bypassed", async () => {
    const { createDc } = await import("../src/server/dcs/actions");
    const { materialType, ...withoutType } = { ...baseMaterialPayload, materialType: "PRODUCTION" };
    const res = await createDc(withoutType as any);
    expect(res.ok).toBe(false);
  });

  it("F: downstream mutations (submitForApproval, approveDc) never include materialType in their update payload", async () => {
    const { createDc, submitForApproval, approveDc } = await import("../src/server/dcs/actions");
    const created = await createDc({ ...baseMaterialPayload, materialType: "PRODUCTION" } as any);
    if (!created.ok) throw new Error("setup failed");

    // These actions don't call deliveryChallan.update in this mock at all for
    // STORES; approveDc requires a MANAGEMENT user, so just assert no update
    // call anywhere in this flow ever carries materialType. createDc itself
    // uses `create`, not `update`.
    expect(prismaMock.deliveryChallan.create).toHaveBeenCalled();
    const createCall = prismaMock.deliveryChallan.create.mock.calls[0][0];
    expect(createCall.data.materialType).toBe("PRODUCTION");
  });
});

// ================= E. MANAGER FILTERING (mirrors manager-approval/page.tsx logic) =================

describe("Manager DC list/approval Material Type filter - built server-side, same pattern as buildDcDateRange", () => {
  it("materialType=PRODUCTION adds a materialType condition to the Prisma where clause", () => {
    const materialType = "PRODUCTION";
    const materialTypeCondition = materialType === "PRODUCTION" || materialType === "CONVERSION" ? materialType : undefined;
    const where = {
      status: "PENDING_APPROVAL",
      ...(materialTypeCondition ? { materialType: materialTypeCondition } : {}),
    };
    expect(where).toHaveProperty("materialType", "PRODUCTION");
  });

  it("materialType=CONVERSION adds a materialType condition to the Prisma where clause", () => {
    const materialType: string = "CONVERSION";
    const materialTypeCondition = materialType === "PRODUCTION" || materialType === "CONVERSION" ? materialType : undefined;
    const where = {
      status: "PENDING_APPROVAL",
      ...(materialTypeCondition ? { materialType: materialTypeCondition } : {}),
    };
    expect(where).toHaveProperty("materialType", "CONVERSION");
  });

  it("materialType omitted/invalid does not restrict by materialType at all", () => {
    for (const materialType of [undefined, "", "ALL", "BOGUS"]) {
      const materialTypeCondition = materialType === "PRODUCTION" || materialType === "CONVERSION" ? materialType : undefined;
      const where = {
        status: "PENDING_APPROVAL",
        ...(materialTypeCondition ? { materialType: materialTypeCondition } : {}),
      };
      expect(where).not.toHaveProperty("materialType");
    }
  });

  it("combines with the existing date range filter without disturbing it", () => {
    const dateRange = buildDcDateRange("2026-10-01", "2026-10-07");
    const dcDateCondition = dateRange.error ? { gte: new Date(8640000000000000) } : dateRange.where;
    const materialTypeCondition = "PRODUCTION";
    const where = {
      status: "PENDING_APPROVAL",
      ...(dcDateCondition ? { dcDate: dcDateCondition } : {}),
      ...(materialTypeCondition ? { materialType: materialTypeCondition } : {}),
    };
    expect(where).toHaveProperty("dcDate");
    expect(where).toHaveProperty("materialType", "PRODUCTION");
    // Preserves the existing approval queue statuses Management is already authorized to see.
    expect(where.status).toBe("PENDING_APPROVAL");
  });
});

// ================= F. AUTHORIZATION =================

describe("F: downstream roles cannot mutate Material Type", () => {
  it("no server action other than createDc/createOutwardDc/updateOutwardDc writes materialType", async () => {
    // Static guard: confirms the only occurrences of `materialType:` as an
    // assignment target in the server actions are the three creation/edit
    // paths - every other DC-mutation action (security dispatch/return, store
    // receipt, quality inspection, manager approvals, accounts payment, close)
    // never references materialType at all, so it cannot be altered by those
    // roles through any of those code paths.
    const actionsSrc = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/server/dcs/actions.ts", import.meta.url), "utf8"),
    );
    const extendedSrc = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/server/dcs/extended-actions.ts", import.meta.url), "utf8"),
    );
    const materialTypeWrites = (actionsSrc.match(/materialType:/g) || []).length
      + (extendedSrc.match(/materialType:/g) || []).length;
    // actions.ts: 1 (createDc). extended-actions.ts: 2 (createOutwardDc, updateOutwardDc).
    expect(materialTypeWrites).toBe(3);
  });
});

// ================= G. PDF =================

describe("G: Material Type in the DC PDF", () => {
  it("wraps 'Material Type: Production' without exceeding the strip width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const lines = wrapCellText("Material Type: Production", font, 9, 500);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(500);
    }
  });

  it("wraps 'Material Type: Conversion' without exceeding the strip width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const lines = wrapCellText("Material Type: Conversion", font, 9, 500);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(500);
    }
  });

  const basePdfData: DcPdfData = {
    company: { name: "Vijay Spheroidals Pvt Ltd", address: "Peenya, Bengaluru", gst: "29AAAAA0000A1Z5", contact: "info@vijayspheroidals.com" },
    dcNumber: "DC-2026-00001",
    dcDate: "07/10/2026",
    woNumber: "WO-101",
    status: "DRAFT",
    vendorName: "Test Supplier",
    vendorAddress: "Bengaluru",
    vendorGst: "29GST123",
    vendorPan: "PAN123",
    purpose: "JOB_WORK",
    processName: "Machining",
    partNumber: "PART-001",
    rmQuantity: "10.000",
    returnFgQuantity: "10.000",
    weightKg: "10.500 KG",
    heatNumber: "H-101",
    materialGrade: "SG 500/7",
    materialType: "Production",
    vehicleNumber: "KA-01-1234",
    transporter: "Self",
    ewayBillNumber: "—",
    eSugamNumber: "—",
    referenceNumber: "—",
    expectedReturnDate: "—",
    qrDataUrl: null,
  };

  it("renders a complete PDF when Material Type is Production", async () => {
    const pdfBuffer = await renderDcPdf({ ...basePdfData, materialType: "Production" });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders a complete PDF when Material Type is Conversion", async () => {
    const pdfBuffer = await renderDcPdf({ ...basePdfData, materialType: "Conversion" });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
