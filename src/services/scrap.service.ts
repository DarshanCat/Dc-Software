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
  if (expectedScrapWeight <= 0) {
    return {
      status: "NOT_APPLICABLE",
      recoveryPercent: null,
      lowerBound: 0,
      upperBound: 0,
      outstanding: -receivedScrapWeight,
    };
  }

  const tol = tolerancePercentage / 100;
  const lowerBound = expectedScrapWeight * (1 - tol);
  const upperBound = expectedScrapWeight * (1 + tol);
  const recoveryPercent = (receivedScrapWeight / expectedScrapWeight) * 100;

  let status: ScrapStatus;
  if (receivedScrapWeight < lowerBound) status = "SCRAP_SHORT";
  else if (receivedScrapWeight > upperBound) status = "EXCESS_SCRAP";
  else status = "WITHIN_TOLERANCE";

  return { status, recoveryPercent, lowerBound, upperBound, outstanding: expectedScrapWeight - receivedScrapWeight };
}