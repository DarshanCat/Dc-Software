import { D, sub, mul, div, lt, gt, lte, percentageOf, toNum } from "../lib/decimal";

export type ScrapStatus = "NOT_APPLICABLE" | "SCRAP_SHORT" | "WITHIN_TOLERANCE" | "EXCESS_SCRAP";

export interface ScrapEvaluation {
  status: ScrapStatus;
  recoveryPercent: number | null;
  lowerBound: number;
  upperBound: number;
  outstanding: number;
}

export function evaluateScrap(
  expectedScrapWeight: number,
  receivedScrapWeight: number,
  tolerancePercentage: number,
): ScrapEvaluation {
  if (lte(expectedScrapWeight, 0)) {
    return {
      status: "NOT_APPLICABLE",
      recoveryPercent: null,
      lowerBound: 0,
      upperBound: 0,
      outstanding: toNum(D(0).minus(receivedScrapWeight)),
    };
  }

  // Decimal-based, like reconciliation/classification's parallel tolerance
  // math - plain JS float arithmetic on fractional kg weights can land a
  // mathematically-exact boundary sum a few ULPs on the wrong side, flipping
  // the DC's scrap status incorrectly.
  const tol = div(tolerancePercentage, 100);
  const lowerBound = mul(expectedScrapWeight, sub(1, tol));
  const upperBound = mul(expectedScrapWeight, D(1).plus(tol));
  const recoveryPercent = percentageOf(receivedScrapWeight, expectedScrapWeight);

  let status: ScrapStatus;
  if (lt(receivedScrapWeight, lowerBound)) status = "SCRAP_SHORT";
  else if (gt(receivedScrapWeight, upperBound)) status = "EXCESS_SCRAP";
  else status = "WITHIN_TOLERANCE";

  return {
    status,
    recoveryPercent: recoveryPercent === null ? null : toNum(recoveryPercent),
    lowerBound: toNum(lowerBound),
    upperBound: toNum(upperBound),
    outstanding: toNum(sub(expectedScrapWeight, receivedScrapWeight)),
  };
}