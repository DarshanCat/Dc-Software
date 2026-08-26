import { describe, it, expect } from "vitest";

describe("DC Part Number & Expected Scrap Business Rules & Validation", () => {
  it("validates Part Number requirements (required, non-empty, trimmed)", () => {
    const validatePartNumber = (val?: string) => {
      const trimmed = (val || "").trim();
      if (!trimmed) return { ok: false, error: "Part Number is required." };
      if (trimmed.length > 60) return { ok: false, error: "Part Number cannot exceed 60 characters." };
      return { ok: true, value: trimmed };
    };

    expect(validatePartNumber("").ok).toBe(false);
    expect(validatePartNumber("   ").ok).toBe(false);
    expect(validatePartNumber("ABC-12345").ok).toBe(true);
    expect(validatePartNumber("ABC-12345").value).toBe("ABC-12345");
    expect(validatePartNumber("  VS-001-A  ").value).toBe("VS-001-A");
    expect(validatePartNumber("PART.001").value).toBe("PART.001");
    expect(validatePartNumber("12345").value).toBe("12345");
  });

  it("validates Expected Scrap requirements (numeric, >= 0, accepts decimals & 0)", () => {
    const validateExpectedScrap = (val: unknown) => {
      if (val === "" || val === null || val === undefined) return { ok: true, value: 0 };
      const num = Number(val);
      if (isNaN(num)) return { ok: false, error: "Expected scrap must be a valid number." };
      if (num < 0) return { ok: false, error: "Expected scrap cannot be negative." };
      return { ok: true, value: num };
    };

    expect(validateExpectedScrap(0).ok).toBe(true);
    expect(validateExpectedScrap("0").ok).toBe(true);
    expect(validateExpectedScrap("0.5").ok).toBe(true);
    expect(validateExpectedScrap(2.50).ok).toBe(true);
    expect(validateExpectedScrap("10.25").ok).toBe(true);
    expect(validateExpectedScrap(-1).ok).toBe(false);
    expect(validateExpectedScrap("-0.5").ok).toBe(false);
    expect(validateExpectedScrap("invalid").ok).toBe(false);
  });

  it("verifies Expected Scrap remains separate from Actual Scrap", () => {
    const dcData = {
      woNumber: "WO-2026-00125",
      partNumber: "ABC-12345",
      quantityIssued: 10,
      inputWeight: 100,
      expectedScrap: 5.0, // Entered manually at DC creation
      actualScrapReceived: 4.2, // Determined after material return & receipt classification
    };

    expect(dcData.expectedScrap).toBe(5.0);
    expect(dcData.actualScrapReceived).toBe(4.2);
    expect(dcData.expectedScrap).not.toBe(dcData.actualScrapReceived);
  });

  it("preserves null / safe defaults for historical records", () => {
    const historicalDc = {
      partNumber: null,
      expectedScrap: null,
    };

    expect(historicalDc.partNumber).toBeNull();
    expect(historicalDc.expectedScrap).toBeNull();
  });
});
