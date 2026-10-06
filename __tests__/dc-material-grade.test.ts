import { describe, it, expect } from "vitest";
import { createDcSchema, outwardDcSchema, validateMaterialGrade, MAX_MATERIAL_GRADE_LENGTH } from "../src/lib/validation/dc";
import { wrapCellText } from "../src/services/dc-pdf";
import { PDFDocument, StandardFonts } from "pdf-lib";

const baseMaterialPayload = {
  movementType: "MATERIAL" as const,
  vendorId: "vendor-1",
  woNumber: "WO-1001",
  partNumber: "PART-9",
  rmQuantity: 100,
  returnFgQuantity: 98,
  heatNumber: "HEAT-1",
  outwardWeight: 50,
  pricingBasis: "RM" as const,
  ratePerQuantity: 10,
  purpose: "JOB_WORK" as const,
  preparedByName: "Tester",
};

describe("validateMaterialGrade (shared business rule)", () => {
  it("12: rejects a blank grade for MATERIAL DCs", () => {
    expect(validateMaterialGrade("MATERIAL", "")).toMatch(/required/i);
    expect(validateMaterialGrade("MATERIAL", undefined)).toMatch(/required/i);
    expect(validateMaterialGrade("MATERIAL", null)).toMatch(/required/i);
  });

  it("rejects a whitespace-only grade", () => {
    expect(validateMaterialGrade("MATERIAL", "   ")).toMatch(/required/i);
  });

  it("13: accepts a valid grade and does not alter its casing/spacing beyond trimming", () => {
    expect(validateMaterialGrade("MATERIAL", "SG 500/7")).toBeNull();
  });

  it("does not require grade for TOOL or COMPANY_PROPERTY DCs", () => {
    expect(validateMaterialGrade("TOOL", undefined)).toBeNull();
    expect(validateMaterialGrade("COMPANY_PROPERTY", "")).toBeNull();
  });

  it("accepts real-world grade designations containing spaces, slashes, and hyphens", () => {
    for (const grade of ["SG 500/7", "EN-GJS-500-7", "GG 25", "FG 260"]) {
      expect(validateMaterialGrade("MATERIAL", grade)).toBeNull();
    }
  });

  it("rejects a grade exceeding the maximum length", () => {
    const tooLong = "A".repeat(MAX_MATERIAL_GRADE_LENGTH + 1);
    expect(validateMaterialGrade("MATERIAL", tooLong)).toMatch(/cannot exceed/i);
  });

  it("accepts a grade exactly at the maximum length", () => {
    const exact = "A".repeat(MAX_MATERIAL_GRADE_LENGTH);
    expect(validateMaterialGrade("MATERIAL", exact)).toBeNull();
  });
});

describe("createDcSchema - Material Grade required at DC creation (Stores creating a Material DC)", () => {
  it("11: accepts a Material DC with Material Grade present", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, materialGrade: "SG 500/7" });
    expect(parsed.success).toBe(true);
  });

  it("12: rejects a Material DC with no grade supplied at all", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("materialGrade"))).toBe(true);
    }
  });

  it("rejects a blank-string grade", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, materialGrade: "   " });
    expect(parsed.success).toBe(false);
  });

  it("13: trims surrounding whitespace but preserves the entered grade otherwise", () => {
    const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, materialGrade: "  SG 500/7  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.materialGrade).toBe("SG 500/7");
    }
  });

  it("preserves exotic but legitimate grade formats without rejecting them", () => {
    for (const grade of ["SG 500/7", "EN-GJS-500-7", "GG 25", "FG 260"]) {
      const parsed = createDcSchema.safeParse({ ...baseMaterialPayload, materialGrade: grade });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.materialGrade).toBe(grade);
    }
  });

  it("does not require Material Grade for a TOOL DC", () => {
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

describe("outwardDcSchema - Material Grade on the Outgoing DC creation flow", () => {
  it("accepts a valid grade string", () => {
    const parsed = outwardDcSchema.safeParse({ vendorId: "v1", materialGrade: "EN-GJS-500-7" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a grade exceeding the schema's max length", () => {
    const parsed = outwardDcSchema.safeParse({ vendorId: "v1", materialGrade: "A".repeat(100) });
    expect(parsed.success).toBe(false);
  });
});

describe("21/22: Material Grade in the DC PDF", () => {
  it("wraps a very long grade designation without exceeding the cell width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const maxWidth = 150;

    const longGrade = "EXTREMELY-LONG-MATERIAL-GRADE-DESIGNATION-WITHOUT-SPACES-SG-500-7-SPECIAL-VARIANT-XYZ";
    const lines = wrapCellText(longGrade, font, fontSize, maxWidth);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, fontSize)).toBeLessThanOrEqual(maxWidth);
    }
    // No data lost in wrapping.
    expect(lines.join("").replace(/\s+/g, "")).toBe(longGrade.replace(/\s+/g, ""));
  });

  it("renders short real-world grade values cleanly", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    for (const grade of ["SG 500/7", "EN-GJS-500-7", "GG 25", "FG 260"]) {
      const lines = wrapCellText(grade, font, 9, 150);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.join(" ").replace(/\s+/g, "")).toBe(grade.replace(/\s+/g, ""));
    }
  });
});
