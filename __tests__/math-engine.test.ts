import { describe, it, expect } from "vitest";
import {
  productionAchievement,
  rejectionRate,
  stageCompletionPct,
  yieldPct,
  stageResultBalance,
  reconciliationVariance,
} from "@/analytics/math-engine";

describe("Math Engine Deterministic Functions", () => {
  it("calculates production achievement percentage", () => {
    expect(productionAchievement(100, 80)).toBe(80.0);
    expect(productionAchievement(100, 105)).toBe(105.0);
    expect(productionAchievement(0, 50)).toBe(0);
  });

  it("calculates rejection rate percentage", () => {
    expect(rejectionRate(90, 10)).toBe(10.0);
    expect(rejectionRate(0, 0)).toBe(0);
  });

  it("calculates stage completion percentage capped at 100", () => {
    expect(stageCompletionPct(100, 50)).toBe(50.0);
    expect(stageCompletionPct(100, 120)).toBe(100.0);
  });

  it("calculates yield percentage", () => {
    expect(yieldPct(85, 100)).toBe(85.0);
    expect(yieldPct(0, 0)).toBe(0);
  });

  it("validates mandatory Quality Inspection Quantity Reconciliation (Good + Rejection + Scrap = Actual Inward Qty)", () => {
    // Valid: 80 + 15 + 5 = 100
    const validResult = stageResultBalance(80, 15, 5, 100);
    expect(validResult.total).toBe(100);
    expect(validResult.balance).toBe(0);
    expect(validResult.isValid).toBe(true);

    // Invalid: 80 + 10 + 5 = 95 != 100 (Balance = 5)
    const invalidResult = stageResultBalance(80, 10, 5, 100);
    expect(invalidResult.total).toBe(95);
    expect(invalidResult.balance).toBe(5);
    expect(invalidResult.isValid).toBe(false);
  });

  it("calculates weight reconciliation variance", () => {
    const res = reconciliationVariance(100, 105);
    expect(res.variance).toBe(5.0);
    expect(res.variancePct).toBe(5.0);
  });
});
