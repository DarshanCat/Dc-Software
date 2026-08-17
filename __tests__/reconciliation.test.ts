import { describe, it, expect } from "vitest";
import { reconcile, computeExpected } from "../src/services/reconciliation.service";

describe("reconcile — critical spec scenarios", () => {
  it("balanced DC is eligible for closure (unaccounted = 0)", () => {
    const r = reconcile({
      inputWeight: 1000,
      finishedWeight: 900,
      scrapWeight: 90,
      approvedProcessLoss: 10,
      expectedFinishedWeight: 900,
      expectedScrapWeight: 90,
    });
    expect(r.breakdown.accountedWeight).toBe("1000.000");
    expect(r.breakdown.unaccountedWeight).toBe("0.000");
    expect(r.status).toBe("BALANCED");
    expect(r.eligibleForClosure).toBe(true);
    expect(r.exceptionTypes).toHaveLength(0);
  });

  it("short return produces 8 kg unaccounted and an EXCEPTION", () => {
    const r = reconcile({
      inputWeight: 1000,
      finishedWeight: 895,
      scrapWeight: 87,
      approvedProcessLoss: 10,
      expectedFinishedWeight: 900,
      expectedScrapWeight: 90,
    });
    expect(r.breakdown.accountedWeight).toBe("992.000");
    expect(r.breakdown.unaccountedWeight).toBe("8.000");
    expect(r.status).toBe("EXCEPTION");
    expect(r.eligibleForClosure).toBe(false);
    expect(r.exceptionTypes).toContain("MATERIAL_SHORTAGE");
  });
});

describe("reconcile — scrap tolerance", () => {
  const base = {
    inputWeight: 1000,
    finishedWeight: 900,
    approvedProcessLoss: 10,
    expectedFinishedWeight: 900,
    expectedScrapWeight: 100,
    scrapTolerancePercentage: 2,
  };

  it("95 kg scrap (below band) flags SCRAP_SHORTAGE", () => {
    const r = reconcile({ ...base, scrapWeight: 95 });
    expect(r.flags.scrapShortage).toBe(true);
    expect(r.exceptionTypes).toContain("SCRAP_SHORTAGE");
  });

  it("103 kg scrap (above band) flags EXCESS_SCRAP", () => {
    const r = reconcile({ ...base, scrapWeight: 103 });
    expect(r.flags.excessScrap).toBe(true);
    expect(r.exceptionTypes).toContain("EXCESS_SCRAP");
  });

  it("100 kg scrap (in band) does not flag scrap issues", () => {
    const r = reconcile({ ...base, scrapWeight: 100 });
    expect(r.flags.scrapShortage).toBe(false);
    expect(r.flags.excessScrap).toBe(false);
  });
});

describe("reconcile — zero expected scrap must not divide by zero", () => {
  it("returns null recovery percent when expected scrap is 0", () => {
    const r = reconcile({
      inputWeight: 500,
      finishedWeight: 495,
      scrapWeight: 0,
      approvedProcessLoss: 5,
      expectedFinishedWeight: 495,
      expectedScrapWeight: 0,
    });
    expect(r.breakdown.scrapRecoveryPercent).toBeNull();
    expect(r.breakdown.unaccountedWeight).toBe("0.000");
    expect(r.status).toBe("BALANCED");
  });
});

describe("reconcile — decimal precision, no float drift", () => {
  it("0.1 + 0.2 style inputs reconcile exactly", () => {
    const r = reconcile({
      inputWeight: "0.3",
      finishedWeight: "0.1",
      scrapWeight: "0.2",
      approvedProcessLoss: 0,
      expectedFinishedWeight: "0.1",
      expectedScrapWeight: "0.2",
    });
    expect(r.breakdown.unaccountedWeight).toBe("0.000");
    expect(r.status).toBe("BALANCED");
  });
});

describe("reconcile — unaccounted tolerance band", () => {
  it("small unaccounted within tolerance stays BALANCED", () => {
    const r = reconcile({
      inputWeight: 1000,
      finishedWeight: 899,
      scrapWeight: 90,
      approvedProcessLoss: 10,
      expectedFinishedWeight: 899,
      expectedScrapWeight: 90,
      unaccountedTolerancePercentage: 0.5,
    });
    expect(r.breakdown.unaccountedWeight).toBe("1.000");
    expect(r.flags.unaccountedOutOfTolerance).toBe(false);
    expect(r.status).toBe("BALANCED");
  });
});

describe("computeExpected — DC creation math", () => {
  it("PERCENTAGE type derives finished/scrap/loss that balance to input", () => {
    const e = computeExpected({
      inputWeight: 1000,
      calculationType: "PERCENTAGE",
      expectedScrapPercentage: 9,
      allowedProcessLossPercentage: 1,
    });
    expect(e.expectedScrapWeight).toBe("90.000");
    expect(e.allowedProcessLoss).toBe("10.000");
    expect(e.expectedFinishedWeight).toBe("900.000");
    expect(e.expectedAccounted).toBe("1000.000");
    expect(e.balances).toBe(true);
  });

  it("FIXED type balances when the numbers add up", () => {
    const e = computeExpected({
      inputWeight: 1000,
      calculationType: "FIXED",
      expectedOutputWeight: 900,
      expectedScrapWeight: 90,
      allowedProcessLoss: 10,
    });
    expect(e.balances).toBe(true);
  });
});