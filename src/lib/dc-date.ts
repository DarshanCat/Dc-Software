/**
 * DC date helpers. DeliveryChallan.dcDate is stored as an instant (UTC). Users pick
 * calendar days in India, so day boundaries are computed in IST (UTC+05:30, no DST)
 * instead of the server's local zone - otherwise a DC created at 02:00 IST would fall
 * on the previous day when the server (e.g. Vercel) runs in UTC.
 */
export const BUSINESS_UTC_OFFSET_MINUTES = 330;
const BUSINESS_TIME_ZONE = "Asia/Kolkata";
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses a strict `YYYY-MM-DD` value; returns null for blank or invalid dates. */
export function parseDateInput(value: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Start instant (inclusive) of the business-timezone calendar day. */
export function startOfBusinessDay(parts: { y: number; m: number; d: number }): Date {
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d) - BUSINESS_UTC_OFFSET_MINUTES * MINUTE_MS);
}

/** Last millisecond (inclusive) of the business-timezone calendar day. */
export function endOfBusinessDay(parts: { y: number; m: number; d: number }): Date {
  return new Date(startOfBusinessDay(parts).getTime() + DAY_MS - 1);
}

export interface DcDateRangeResult {
  /** Prisma `dcDate` condition, or undefined when no date filter applies. */
  where?: { gte?: Date; lte?: Date };
  error?: string;
}

/**
 * Builds the server-side `dcDate` condition from the From/To inputs.
 * From only -> from that day onward; To only -> up to and including that day;
 * both -> inclusive range. From > To or an unparseable date yields an error and
 * callers must return no rows.
 */
export function buildDcDateRange(from?: string | null, to?: string | null): DcDateRangeResult {
  const fromRaw = from?.trim() || "";
  const toRaw = to?.trim() || "";
  const fromParts = parseDateInput(fromRaw);
  const toParts = parseDateInput(toRaw);

  if (fromRaw && !fromParts) return { error: "DC Date From is not a valid date." };
  if (toRaw && !toParts) return { error: "DC Date To is not a valid date." };
  if (!fromParts && !toParts) return {};

  const gte = fromParts ? startOfBusinessDay(fromParts) : undefined;
  const lte = toParts ? endOfBusinessDay(toParts) : undefined;
  if (gte && lte && gte.getTime() > lte.getTime()) {
    return { error: "DC Date From cannot be later than DC Date To." };
  }

  const where: { gte?: Date; lte?: Date } = {};
  if (gte) where.gte = gte;
  if (lte) where.lte = lte;
  return { where };
}

/** Formats a DC date in the business timezone as DD/MM/YYYY. */
export function formatDcDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { timeZone: BUSINESS_TIME_ZONE });
}
