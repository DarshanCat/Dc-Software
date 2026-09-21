import { describe, it, expect } from "vitest";
import { createDcSchema, outwardDcSchema, validateMaterialWeightKg } from "../src/lib/validation/dc";

const baseMaterialPayload = {
  movementType: "MATERIAL" as const,
  vendorId: "vendor-1",
  woNumber: "WO-1001",
  partNumber: "PART-9",
  rmQuantity: 100,
  returnFgQuantity: 98,
  heatNumber: "HEAT-1",
  pricingBasis: "RM" as const,
  ratePerQuantity: 10,
  purpose: "JOB_WORK" as const,
  preparedByName: "Tester",
};

describe("validateMaterialWeightKg (shared business rule)", () => {
  it("requires a positive weight for MATERIAL DCs", () => {
    expect(validateMaterialWeightKg("MATERIAL", 125.75)).toBeNull();
  });

  it("rejects a missing weight for MATERIAL DCs", () => {
    expect(validateMaterialWeightKg("MATERIAL", undefined)).toMatch(/required/i);
    expect(validateMaterialWeightKg("MATERIAL", null)).toMatch(/required/i);
  });

  it("rejects zero and negative weight for MATERIAL DCs", () => {
    expect(validateMaterialWeightKg("MATERIAL", 0)).toMatch(/positive/i);
    expect(validateMaterialWeightKg("MATERIAL", -5)).toMatch(/positive/i);
  });

  it("rejects NaN and Infinity for MATERIAL DCs", () => {
    expect(validateMaterialWeightKg("MATERIAL", NaN)).toMatch(/positive/i);
    expect(validateMaterialWeightKg("MATERIAL", Infinity)).toMatch(/positive/i);
    expect(validateMaterialWeightKg("MATERIAL", -Infinity)).toMatch(/positive/i);
  });

  it("does not require weight for TOOL or COMPANY_PROPERTY DCs", () => {
    expect(validateMaterialWeightKg("TOOL", undefined)).toBeNull();
    expect(validateMaterialWeightKg("COMPANY_PROPERTY", null)).toBeNull();
  });
});

describe("createDcSchema — Weight (KG) at DC creation (Stores creating a Material DC)", () => {
  it("1/2: accepts a valid Material DC with a proper positive decimal weight", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, outwardWeight: 152.75 });
    expect(parsed.success).toBe(true);
  });

  it("rejects a Material DC with no weight supplied at all", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("outwardWeight"))).toBe(true);
    }
  });

  it("rejects zero weight for a Material DC", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, outwardWeight: 0 });
    expect(parsed.success).toBe(false);
  });

  it("rejects negative weight for a Material DC", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, outwardWeight: -12.5 });
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed (non-numeric) weight value", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, outwardWeight: "not-a-number" as any });
    expect(parsed.success).toBe(false);
  });

  it("rejects Infinity as a weight value", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, outwardWeight: Infinity });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unreasonably large weight value", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, outwardWeight: 1_000_000_001 });
    expect(parsed.success).toBe(false);
  });

  it("preserves decimal precision for a fractional KG weight (e.g. 123.456)", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, outwardWeight: 123.456 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.outwardWeight).toBe(123.456);
    }
  });

  it("does not require weight for a TOOL DC (weight is a MATERIAL-only requirement)", () => {
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
});

describe("outwardDcSchema — Weight (KG) on the Outgoing DC creation flow", () => {
  it("accepts a valid positive decimal weight", () => {
    const parsed = outwardDcSchema.safeParse({ vendorId: "v1", outwardWeight: 87.25 });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-finite weight value (Infinity)", () => {
    const parsed = outwardDcSchema.safeParse({ vendorId: "v1", outwardWeight: Infinity });
    expect(parsed.success).toBe(false);
  });

  it("rejects a NaN-producing malformed weight value", () => {
    const parsed = outwardDcSchema.safeParse({ vendorId: "v1", outwardWeight: NaN });
    expect(parsed.success).toBe(false);
  });
});
