import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Numeric = Decimal.Value;

export const D = (v: Numeric | null | undefined): Decimal => new Decimal(v ?? 0);

export const add = (...vals: Numeric[]): Decimal =>
  vals.reduce<Decimal>((acc, v) => acc.plus(D(v)), new Decimal(0));

export const sub = (a: Numeric, b: Numeric): Decimal => D(a).minus(D(b));
export const mul = (a: Numeric, b: Numeric): Decimal => D(a).times(D(b));
export const div = (a: Numeric, b: Numeric): Decimal => D(a).dividedBy(D(b));

export const isZero = (v: Numeric): boolean => D(v).isZero();
export const isNegative = (v: Numeric): boolean => D(v).isNegative();

export const gt = (a: Numeric, b: Numeric): boolean => D(a).greaterThan(D(b));
export const gte = (a: Numeric, b: Numeric): boolean => D(a).greaterThanOrEqualTo(D(b));
export const lt = (a: Numeric, b: Numeric): boolean => D(a).lessThan(D(b));
export const lte = (a: Numeric, b: Numeric): boolean => D(a).lessThanOrEqualTo(D(b));

export const abs = (v: Numeric): Decimal => D(v).abs();
export const round = (v: Numeric, dp = 3): Decimal => D(v).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);

export const percentageOf = (part: Numeric, whole: Numeric): Decimal | null => {
  if (isZero(whole)) return null;
  return div(part, whole).times(100);
};

export const toStr = (v: Numeric, dp = 3): string => round(v, dp).toFixed(dp);
export const toNum = (v: Numeric): number => D(v).toNumber();

export { Decimal };