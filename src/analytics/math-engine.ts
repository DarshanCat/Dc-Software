/**
 * Pure deterministic mathematical functions for manufacturing performance & DC reconciliation.
 * Must never modify source facts, overwrite OMS data, or invent missing values.
 */

export function productionAchievement(targetQty: number, completedQty: number): number {
  if (targetQty <= 0) return 0;
  return Number(((completedQty / targetQty) * 100).toFixed(2));
}

export function rejectionRate(completedQty: number, rejectionQty: number): number {
  const total = completedQty + rejectionQty;
  if (total <= 0) return 0;
  return Number(((rejectionQty / total) * 100).toFixed(2));
}

export function stageCompletionPct(targetQty: number, completedQty: number): number {
  if (targetQty <= 0) return 0;
  return Number(Math.min(100, (completedQty / targetQty) * 100).toFixed(2));
}

export function yieldPct(goodQty: number, totalProcessedQty: number): number {
  if (totalProcessedQty <= 0) return 0;
  return Number(((goodQty / totalProcessedQty) * 100).toFixed(2));
}

export function productionVelocity(completedQty: number, totalHours: number): number {
  if (totalHours <= 0) return 0;
  return Number((completedQty / totalHours).toFixed(2));
}

export function cycleTimeHours(startTime: Date | string, endTime: Date | string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  return Number(((end - start) / (1000 * 60 * 60)).toFixed(2));
}

export function taktTimeSeconds(availableOperatingSeconds: number, customerRequiredQty: number): number {
  if (customerRequiredQty <= 0) return 0;
  return Number((availableOperatingSeconds / customerRequiredQty).toFixed(2));
}

export function oeeProxy(availabilityPct: number, performancePct: number, qualityPct: number): number {
  const oee = (availabilityPct / 100) * (performancePct / 100) * (qualityPct / 100) * 100;
  return Number(oee.toFixed(2));
}

/**
 * Validates Quality Inspection Reconciliation:
 * Good Qty + Rejection Qty + Scrap Qty must equal Actual Inward Qty.
 * Balance = Actual Inward Qty - (Good Qty + Rejection Qty + Scrap Qty)
 */
export function stageResultBalance(
  goodQty: number,
  rejectQty: number,
  scrapQty: number,
  actualInwardQty: number
): { total: number; balance: number; isValid: boolean } {
  const good = Math.max(0, goodQty || 0);
  const reject = Math.max(0, rejectQty || 0);
  const scrap = Math.max(0, scrapQty || 0);
  const inward = Math.max(0, actualInwardQty || 0);

  const total = good + reject + scrap;
  const balance = Number((inward - total).toFixed(3));
  const isValid = balance === 0;

  return { total, balance, isValid };
}

export function reconciliationVariance(expectedWeight: number, actualWeight: number): { variance: number; variancePct: number } {
  const exp = Math.max(0, expectedWeight || 0);
  const act = Math.max(0, actualWeight || 0);
  const variance = Number((act - exp).toFixed(3));
  const variancePct = exp > 0 ? Number(((variance / exp) * 100).toFixed(2)) : 0;

  return { variance, variancePct };
}
