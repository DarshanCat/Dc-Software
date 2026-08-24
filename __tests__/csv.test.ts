import { describe, it, expect } from "vitest";
import { sanitizeCsvCell } from "../src/lib/csv";

describe("CSV Formula Injection Protection", () => {
  it("escapes fields starting with formula characters =, +, -, @", () => {
    expect(sanitizeCsvCell("=1+1")).toBe("\"'=1+1\"");
    expect(sanitizeCsvCell("+100")).toBe("\"'+100\"");
    expect(sanitizeCsvCell("-50")).toBe("\"'-50\"");
    expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe("\"'@SUM(A1:A10)\"");
  });

  it("escapes fields starting with tab or carriage return", () => {
    expect(sanitizeCsvCell("\ttext")).toBe("\"'\ttext\"");
    expect(sanitizeCsvCell("\rtext")).toBe("\"'\rtext\"");
  });

  it("formats normal fields and escapes double quotes", () => {
    expect(sanitizeCsvCell("DC-2026-000001")).toBe('"DC-2026-000001"');
    expect(sanitizeCsvCell('Vendor "ABC" Inc')).toBe('"Vendor ""ABC"" Inc"');
    expect(sanitizeCsvCell(null)).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
  });
});
