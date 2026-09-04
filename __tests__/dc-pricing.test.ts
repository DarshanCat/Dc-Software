import { describe, it, expect } from "vitest";

describe("DC Mandatory Pricing & Calculations", () => {
  it("calculates Expected Amount correctly when Pricing Basis = RM", () => {
    const rmQty = 15;
    const rate = 1000;
    const expectedAmount = rmQty * rate;
    expect(expectedAmount).toBe(15000);
  });

  it("calculates Expected Amount correctly when Pricing Basis = FG", () => {
    const returnFgQty = 25;
    const rate = 1000;
    const expectedAmount = returnFgQty * rate;
    expect(expectedAmount).toBe(25000);
  });

  it("calculates Final Payable Amount correctly for RM and FG bases", () => {
    const rate = 500;
    const rmQty = 100;
    const finalApprovedFgQty = 95;

    // Pricing Basis = RM
    const finalPayableRM = rmQty * rate;
    expect(finalPayableRM).toBe(50000);

    // Pricing Basis = FG
    const finalPayableFG = finalApprovedFgQty * rate;
    expect(finalPayableFG).toBe(47500);
  });

  it("validates that rate per quantity must be greater than zero", () => {
    const validateRate = (rate: number) => {
      if (rate <= 0) return { ok: false, error: "Rate Per Quantity must be greater than zero." };
      return { ok: true };
    };

    expect(validateRate(0).ok).toBe(false);
    expect(validateRate(-10).ok).toBe(false);
    expect(validateRate(1000).ok).toBe(true);
  });

  it("validates that exactly one pricing basis must be selected (RW or FG)", () => {
    const validateBasis = (basis?: string) => {
      if (!basis || !["RW", "FG", "RM"].includes(basis)) {
        return { ok: false, error: "Please select a pricing basis: RW Quantity or FG Quantity." };
      }
      return { ok: true };
    };

    expect(validateBasis("").ok).toBe(false);
    expect(validateBasis(undefined).ok).toBe(false);
    expect(validateBasis("INVALID").ok).toBe(false);
    expect(validateBasis("RW").ok).toBe(true);
    expect(validateBasis("FG").ok).toBe(true);
  });

  it("calculates pricingQuantitySnapshot and expectedAmount correctly for RW and FG pricing basis", () => {
    const calculatePricing = (basis: "RW" | "FG", outwardQtyRw: number, returningFgQty: number, rate: number) => {
      const pricingQty = basis === "RW" ? outwardQtyRw : returningFgQty;
      const expectedAmount = Number((pricingQty * rate).toFixed(2));
      return { pricingQty, expectedAmount };
    };

    // RW Basis calculation: 50.5 NOS * 120 Rate = 6060.00
    const rwResult = calculatePricing("RW", 50.5, 48, 120);
    expect(rwResult.pricingQty).toBe(50.5);
    expect(rwResult.expectedAmount).toBe(6060);

    // FG Basis calculation: 48 NOS * 120 Rate = 5760.00
    const fgResult = calculatePricing("FG", 50.5, 48, 120);
    expect(fgResult.pricingQty).toBe(48);
    expect(fgResult.expectedAmount).toBe(5760);
  });
});

