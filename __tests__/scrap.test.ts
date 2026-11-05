import { describe, it, expect } from "vitest";
import { evaluateScrap } from "../src/services/scrap.service";

describe("evaluateScrap — spec §25-26 scenarios", () => {
  it("expected 100kg, ±2% tolerance, received 95kg -> SCRAP_SHORT", () => {
    const r = evaluateScrap(100, 95, 2);
    expect(r.lowerBound).toBeCloseTo(98, 5);
    expect(r.upperBound).toBeCloseTo(102, 5);
    expect(r.status).toBe("SCRAP_SHORT");
    expect(r.recoveryPercent).toBeCloseTo(95, 5);
  });

  it("expected 100kg, ±2% tolerance, received 103kg -> EXCESS_SCRAP", () => {
    const r = evaluateScrap(100, 103, 2);
    expect(r.status).toBe("EXCESS_SCRAP");
    expect(r.recoveryPercent).toBeCloseTo(103, 5);
  });

  it("expected 100kg, ±2% tolerance, received 100kg -> WITHIN_TOLERANCE", () => {
    const r = evaluateScrap(100, 100, 2);
    expect(r.status).toBe("WITHIN_TOLERANCE");
    expect(r.outstanding).toBeCloseTo(0, 5);
  });

  it("boundary: received exactly at lower bound (98kg) is within tolerance, not short", () => {
    const r = evaluateScrap(100, 98, 2);
    expect(r.status).toBe("WITHIN_TOLERANCE");
  });

  it("boundary: received exactly at upper bound (102kg) is within tolerance, not excess", () => {
    const r = evaluateScrap(100, 102, 2);
    expect(r.status).toBe("WITHIN_TOLERANCE");
  });

  it("zero expected scrap never divides by zero — recoveryPercent is null, status NOT_APPLICABLE", () => {
    const r = evaluateScrap(0, 5, 2);
    expect(r.recoveryPercent).toBeNull();
    expect(r.status).toBe("NOT_APPLICABLE");
    expect(Number.isFinite(r.outstanding)).toBe(true);
  });

  it("zero tolerance requires an exact match", () => {
    expect(evaluateScrap(90, 89.99, 0).status).toBe("SCRAP_SHORT");
    expect(evaluateScrap(90, 90, 0).status).toBe("WITHIN_TOLERANCE");
    expect(evaluateScrap(90, 90.01, 0).status).toBe("EXCESS_SCRAP");
  });

  it("a tolerance band computed from fractional (repeating-binary) inputs still lands precisely on its own boundary", () => {
    // 100 * (1 - 0.015) in plain JS float math is 98.5 with no visible error
    // here, but tolerance fractions in general are prone to binary rounding;
    // evaluateScrap computes lowerBound/upperBound via Decimal specifically
    // so a receivedScrapWeight equal to the true mathematical boundary always
    // compares as WITHIN_TOLERANCE, never SCRAP_SHORT/EXCESS_SCRAP from a few
    // ULPs of float noise in the bound itself.
    const r = evaluateScrap(100, 98.5, 1.5);
    expect(r.lowerBound).toBeCloseTo(98.5, 10);
    expect(r.status).toBe("WITHIN_TOLERANCE");
  });
});