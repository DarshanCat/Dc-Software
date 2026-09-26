import { describe, it, expect } from "vitest";
import { formatQuantity, formatWeightKg } from "../src/lib/quantity-format";

describe("Quantity vs Weight display (RM QTY / EXP FG QTY must never show as KG)", () => {
  it("renders RM QTY as quantity + actual UOM, not as weight in KG", () => {
    const quantity = 10;
    const uom = "NOS";
    const weightKg = 125.5;

    const rmQtyDisplay = formatQuantity(quantity, uom);
    const weightDisplay = formatWeightKg(weightKg);

    expect(rmQtyDisplay).toBe("10.000 NOS");
    expect(weightDisplay).toBe("125.5 KG");

    expect(rmQtyDisplay).not.toBe("10 KG");
    expect(rmQtyDisplay).not.toContain("KG");
  });

  it("renders EXP FG QTY as its own quantity + actual UOM, independent of RM QTY and weight", () => {
    const expFgQuantity = 8;
    const fgUom = "NOS";
    const weightKg = 125.5;

    const expFgDisplay = formatQuantity(expFgQuantity, fgUom);
    const weightDisplay = formatWeightKg(weightKg);

    expect(expFgDisplay).toBe("8.000 NOS");
    expect(weightDisplay).toBe("125.5 KG");

    expect(expFgDisplay).not.toBe("8 KG");
    expect(expFgDisplay).not.toContain("KG");
  });

  it("falls back to NOS when a DC record has no rmUom/fgUom recorded (legacy default)", () => {
    expect(formatQuantity(10, null)).toBe("10.000 NOS");
    expect(formatQuantity(10, undefined)).toBe("10.000 NOS");
  });

  it("uses the record's actual UOM when it differs from NOS (e.g. KG-measured material)", () => {
    // Even when the true UOM legitimately is KG, it must come from the uom field,
    // never be assumed/hardcoded onto the quantity slot.
    expect(formatQuantity(150, "KG")).toBe("150.000 KG");
    expect(formatQuantity(2.5, "MTR")).toBe("2.500 MTR");
  });

  it("returns an em-dash placeholder for missing quantity, matching prior null-handling behavior", () => {
    expect(formatQuantity(null, "NOS")).toBe("—");
    expect(formatQuantity(undefined, "NOS")).toBe("—");
  });

  it("returns an em-dash placeholder for missing weight", () => {
    expect(formatWeightKg(null)).toBe("—");
    expect(formatWeightKg(undefined)).toBe("—");
  });
});
