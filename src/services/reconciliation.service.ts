/**
 * reconciliation.service.ts — the core material-accountability logic.
 * PURE: no Prisma/React/HTTP. Decimal-safe. Independently testable.
 */
import { D, add, sub, abs, gt, lt, isZero, percentageOf, round, Decimal } from "../lib/decimal";
import type { Numeric } from "../lib/decimal";

export type RejectionRule = "REJECTED_COUNTS_AS_RETURNED" | "REJECTED_IS_SHORTAGE";

export interface ReconciliationInput {
  inputWeight: Numeric;
  finishedWeight: Numeric;
  scrapWeight: Numeric;
  rejectedWeight?: Numeric;
  approvedProcessLoss: Numeric;
  expectedFinishedWeight: Numeric;
  expectedScrapWeight: Numeric;
  unaccountedTolerancePercentage?: Numeric;
  scrapTolerancePercentage?: Numeric;
  rejectionRule?: RejectionRule;
}

export type ReconciliationStatus = "BALANCED" | "EXCEPTION";

export interface ReconciliationBreakdown {
  inputWeight: string;
  finishedWeight: string;
  scrapWeight: string;
  rejectedWeight: string;
  approvedProcessLoss: string;
  accountedWeight: string;
  unaccountedWeight: string;
  scrapRecoveryPercent: string | null;
  scrapOutstanding: string;
}

export interface ReconciliationFlags {
  materialShortage: boolean;
  scrapShortage: boolean;
  excessScrap: boolean;
  processLossExceeded: boolean;
  unaccountedOutOfTolerance: boolean;
}

export interface ReconciliationResult {
  status: ReconciliationStatus;
  breakdown: ReconciliationBreakdown;
  flags: ReconciliationFlags;
  exceptionTypes: string[];
  eligibleForClosure: boolean;
}

const DEFAULT_UNACCOUNTED_TOLERANCE_PCT = 0;
const DEFAULT_SCRAP_TOLERANCE_PCT = 2;

export function reconcile(input: ReconciliationInput): ReconciliationResult {
  const inputWeight = D(input.inputWeight);
  const finishedWeight = D(input.finishedWeight);
  const scrapWeight = D(input.scrapWeight);
  const rejectedWeight = D(input.rejectedWeight ?? 0);
  const approvedProcessLoss = D(input.approvedProcessLoss);
  const expectedFinished = D(input.expectedFinishedWeight);
  const expectedScrap = D(input.expectedScrapWeight);
  const rule: RejectionRule = input.rejectionRule ?? "REJECTED_IS_SHORTAGE";

  const unaccountedTolPct = D(input.unaccountedTolerancePercentage ?? DEFAULT_UNACCOUNTED_TOLERANCE_PCT);
  const scrapTolPct = D(input.scrapTolerancePercentage ?? DEFAULT_SCRAP_TOLERANCE_PCT);

  const rejectedContribution = rule === "REJECTED_COUNTS_AS_RETURNED" ? rejectedWeight : D(0);
  const accountedWeight = add(finishedWeight, scrapWeight, rejectedContribution, approvedProcessLoss);
  const unaccountedWeight = sub(inputWeight, accountedWeight);

  const unaccountedToleranceAbs = inputWeight.times(unaccountedTolPct).dividedBy(100).abs();
  const unaccountedOutOfTolerance = gt(abs(unaccountedWeight), unaccountedToleranceAbs);

  const scrapRecoveryPercent = percentageOf(scrapWeight, expectedScrap);
  const scrapOutstanding = sub(expectedScrap, scrapWeight);

  let scrapShortage = false;
  let excessScrap = false;
  if (!isZero(expectedScrap)) {
    const scrapToleranceAbs = expectedScrap.times(scrapTolPct).dividedBy(100);
    const lowerBound = expectedScrap.minus(scrapToleranceAbs);
    const upperBound = expectedScrap.plus(scrapToleranceAbs);
    if (lt(scrapWeight, lowerBound)) scrapShortage = true;
    if (gt(scrapWeight, upperBound)) excessScrap = true;
  }

  const materialShortage = lt(finishedWeight, expectedFinished);
  const processLossExceeded = gt(unaccountedWeight, D(0)) && unaccountedOutOfTolerance;

  const flags: ReconciliationFlags = {
    materialShortage,
    scrapShortage,
    excessScrap,
    processLossExceeded,
    unaccountedOutOfTolerance,
  };

  const exceptionTypes: string[] = [];
  if (materialShortage) exceptionTypes.push("MATERIAL_SHORTAGE");
  if (scrapShortage) exceptionTypes.push("SCRAP_SHORTAGE");
  if (excessScrap) exceptionTypes.push("EXCESS_SCRAP");
  if (processLossExceeded) exceptionTypes.push("PROCESS_LOSS_EXCEEDED");
  if (unaccountedOutOfTolerance && !processLossExceeded) exceptionTypes.push("WEIGHT_MISMATCH");

  const status: ReconciliationStatus = exceptionTypes.length > 0 ? "EXCEPTION" : "BALANCED";
  const eligibleForClosure = status === "BALANCED";

  return {
    status,
    flags,
    exceptionTypes,
    eligibleForClosure,
    breakdown: {
      inputWeight: round(inputWeight).toFixed(3),
      finishedWeight: round(finishedWeight).toFixed(3),
      scrapWeight: round(scrapWeight).toFixed(3),
      rejectedWeight: round(rejectedWeight).toFixed(3),
      approvedProcessLoss: round(approvedProcessLoss).toFixed(3),
      accountedWeight: round(accountedWeight).toFixed(3),
      unaccountedWeight: round(unaccountedWeight).toFixed(3),
      scrapRecoveryPercent: scrapRecoveryPercent === null ? null : round(scrapRecoveryPercent, 2).toFixed(2),
      scrapOutstanding: round(scrapOutstanding).toFixed(3),
    },
  };
}

export interface ExpectedInput {
  inputWeight: Numeric;
  calculationType: "FIXED" | "PERCENTAGE" | "INPUT_MINUS_OUTPUT" | "MANUAL";
  expectedScrapPercentage?: Numeric;
  allowedProcessLossPercentage?: Numeric;
  expectedOutputWeight?: Numeric;
  expectedScrapWeight?: Numeric;
  allowedProcessLoss?: Numeric;
}

export interface ExpectedResult {
  expectedFinishedWeight: string;
  expectedScrapWeight: string;
  allowedProcessLoss: string;
  expectedAccounted: string;
  balances: boolean;
}

export function computeExpected(input: ExpectedInput, tolerancePercentage: Numeric = 0): ExpectedResult {
  const inputWeight = D(input.inputWeight);
  let finished: Decimal;
  let scrap: Decimal;
  let loss: Decimal;

  switch (input.calculationType) {
    case "PERCENTAGE": {
      scrap = inputWeight.times(D(input.expectedScrapPercentage ?? 0)).dividedBy(100);
      loss = inputWeight.times(D(input.allowedProcessLossPercentage ?? 0)).dividedBy(100);
      finished = inputWeight.minus(scrap).minus(loss);
      break;
    }
    case "INPUT_MINUS_OUTPUT": {
      scrap = D(input.expectedScrapWeight ?? 0);
      loss = D(input.allowedProcessLoss ?? 0);
      finished = inputWeight.minus(scrap).minus(loss);
      break;
    }
    case "FIXED":
    case "MANUAL":
    default: {
      finished = D(input.expectedOutputWeight ?? 0);
      scrap = D(input.expectedScrapWeight ?? 0);
      loss = D(input.allowedProcessLoss ?? 0);
      break;
    }
  }

  const accounted = add(finished, scrap, loss);
  const toleranceAbs = inputWeight.times(D(tolerancePercentage)).dividedBy(100).abs();
  const balances = abs(sub(inputWeight, accounted)).lessThanOrEqualTo(toleranceAbs);

  return {
    expectedFinishedWeight: round(finished).toFixed(3),
    expectedScrapWeight: round(scrap).toFixed(3),
    allowedProcessLoss: round(loss).toFixed(3),
    expectedAccounted: round(accounted).toFixed(3),
    balances,
  };
}