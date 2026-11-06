import { describe, it, expect } from "vitest";
import { createDcSchema, outwardDcSchema } from "@/lib/validation/dc";

const baseMaterialDc = {
  movementType: "MATERIAL" as const,
  vendorId: "v-123",
  woNumber: "WO-2026-001",
  partNumber: "PN-101",
  rmQuantity: 9,
  returnFgQuantity: 27,
  outwardWeight: 1620,
  heatNumber: "HT-1026",
  length: 215,
  width: 235,
  height: 450,
  materialGrade: "450-B",
  materialType: "PRODUCTION" as const,
  pricingBasis: "FG" as const,
  ratePerQuantity: 480,
  preparedByName: "Lingaraju kc",
  purpose: "JOB_WORK" as const,
};

describe("DC Return Gattings (NOS) Specification", () => {
  it("validates valid returnGatingQty in createDcSchema", () => {
    const valid = createDcSchema.safeParse({
      ...baseMaterialDc,
      returnGatingQty: 6,
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.returnGatingQty).toBe(6);
    }
  });

  it("accepts returnGatingQty of 0 in createDcSchema", () => {
    const valid = createDcSchema.safeParse({
      ...baseMaterialDc,
      returnGatingQty: 0,
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.returnGatingQty).toBe(0);
    }
  });

  it("allows returnGatingQty to be omitted (optional)", () => {
    const valid = createDcSchema.safeParse({
      ...baseMaterialDc,
    });

    expect(valid.success).toBe(true);
  });

  it("rejects negative returnGatingQty in createDcSchema", () => {
    const result = createDcSchema.safeParse({
      ...baseMaterialDc,
      returnGatingQty: -5,
    });

    expect(result.success).toBe(false);
  });

  it("validates returnGatingQty in outwardDcSchema", () => {
    const result = outwardDcSchema.safeParse({
      movementType: "MATERIAL",
      vendorId: "v-123",
      woNumber: "WO-2026-005",
      partNumber: "PN-105",
      outwardQtyRw: 10,
      returningFgQuantity: 10,
      returnGatingQty: 12,
      outwardWeight: 500,
      materialGrade: "450-B",
      pricingBasis: "RW",
      ratePerQuantity: 50,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.returnGatingQty).toBe(12);
    }
  });
});
