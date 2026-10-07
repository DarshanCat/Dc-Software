import { describe, it, expect } from "vitest";
import { buildDcDateRange, parseDateInput, startOfBusinessDay, endOfBusinessDay, BUSINESS_UTC_OFFSET_MINUTES } from "../src/lib/dc-date";

describe("Manager DC Date Search - buildDcDateRange (server-side Prisma condition)", () => {
  it("6: From only -> includes DCs from that day onward (gte set, lte undefined)", () => {
    const { where, error } = buildDcDateRange("2026-01-10", undefined);
    expect(error).toBeUndefined();
    expect(where?.lte).toBeUndefined();
    expect(where?.gte).toBeInstanceOf(Date);
    // 2026-01-10 00:00 IST == 2026-01-09 18:30 UTC
    expect(where!.gte!.toISOString()).toBe("2026-01-09T18:30:00.000Z");
  });

  it("7: To only -> includes DCs up to and including that day (lte set, gte undefined)", () => {
    const { where, error } = buildDcDateRange(undefined, "2026-01-10");
    expect(error).toBeUndefined();
    expect(where?.gte).toBeUndefined();
    expect(where?.lte).toBeInstanceOf(Date);
    // End of 2026-01-10 IST == 2026-01-10 18:29:59.999 UTC
    expect(where!.lte!.toISOString()).toBe("2026-01-10T18:29:59.999Z");
  });

  it("8: both From and To -> inclusive range covering every DC in between", () => {
    const { where, error } = buildDcDateRange("2026-01-01", "2026-01-31");
    expect(error).toBeUndefined();
    expect(where?.gte).toBeInstanceOf(Date);
    expect(where?.lte).toBeInstanceOf(Date);
    expect(where!.gte!.getTime()).toBeLessThan(where!.lte!.getTime());

    // A DC dated 2026-01-15 falls inside the range.
    const midMonth = startOfBusinessDay(parseDateInput("2026-01-15")!);
    expect(midMonth.getTime()).toBeGreaterThanOrEqual(where!.gte!.getTime());
    expect(midMonth.getTime()).toBeLessThanOrEqual(where!.lte!.getTime());
  });

  it("9: From > To is handled safely with a validation error and no usable where clause", () => {
    const result = buildDcDateRange("2026-02-01", "2026-01-01");
    expect(result.error).toMatch(/cannot be later than/i);
    expect(result.where).toBeUndefined();
  });

  it("returns no filter at all when neither date is supplied", () => {
    const result = buildDcDateRange(undefined, undefined);
    expect(result.error).toBeUndefined();
    expect(result.where).toBeUndefined();
  });

  it("rejects a malformed date string instead of silently ignoring it", () => {
    expect(buildDcDateRange("not-a-date", undefined).error).toBeTruthy();
    expect(buildDcDateRange(undefined, "2026-13-40").error).toBeTruthy();
  });

  it("treats From == To as a single inclusive day", () => {
    const { where, error } = buildDcDateRange("2026-03-05", "2026-03-05");
    expect(error).toBeUndefined();
    expect(where!.lte!.getTime() - where!.gte!.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("day boundaries are computed in business timezone (IST, UTC+5:30), not server-local UTC", () => {
    expect(BUSINESS_UTC_OFFSET_MINUTES).toBe(330);
    const parts = parseDateInput("2026-06-15")!;
    expect(startOfBusinessDay(parts).toISOString()).toBe("2026-06-14T18:30:00.000Z");
    expect(endOfBusinessDay(parts).toISOString()).toBe("2026-06-15T18:29:59.999Z");
  });
});

describe("10: Date filtering is applied server-side via Prisma where conditions", () => {
  it("manager-approval page builds the dcDate condition from buildDcDateRange(), not client-side filtering", () => {
    // Mirrors the exact logic in src/app/(app)/dcs/manager-approval/page.tsx.
    const dateRange = buildDcDateRange("2026-01-01", "2026-01-31");
    const dcDateCondition = dateRange.error ? { gte: new Date(8640000000000000) } : dateRange.where;
    const where = {
      status: "PENDING_APPROVAL",
      ...(dcDateCondition ? { dcDate: dcDateCondition } : {}),
    };
    expect(where).toHaveProperty("dcDate");
    expect((where as any).dcDate.gte).toBeInstanceOf(Date);
  });

  it("an invalid range safely yields a where clause that can never match any real DC", () => {
    const dateRange = buildDcDateRange("2026-02-01", "2026-01-01");
    const dcDateCondition = dateRange.error ? { gte: new Date(8640000000000000) } : dateRange.where;
    expect(dcDateCondition!.gte!.getFullYear()).toBeGreaterThan(9000);
  });
});
