import { describe, it, expect } from "vitest";
import { renderReportPdf } from "../src/services/report-pdf";

describe("renderReportPdf (generic landscape report table PDF)", () => {
  it("renders a valid PDF with multiple rows and columns", async () => {
    const buffer = await renderReportPdf({
      title: "Tools Currently With Vendor",
      subtitle: "Generated for testing",
      columns: [
        { header: "DC NUMBER", width: 0.3 },
        { header: "VENDOR", width: 0.3 },
        { header: "TOOL CODE", width: 0.4 },
      ],
      rows: [
        ["DC-TOOL-001", "Vendor A", "TL-001"],
        ["DC-TOOL-002", "Vendor B", "TL-002"],
      ],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders a valid PDF with zero rows (shows a 'no records' message rather than crashing)", async () => {
    const buffer = await renderReportPdf({
      title: "Tools Currently With Vendor",
      columns: [{ header: "DC NUMBER", width: 1 }],
      rows: [],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("paginates cleanly across many rows without crashing", async () => {
    const rows = Array.from({ length: 80 }, (_, i) => [`DC-${i}`, `Vendor ${i}`, `TL-${i}`]);
    const buffer = await renderReportPdf({
      title: "Tools Currently With Vendor",
      columns: [
        { header: "DC NUMBER", width: 0.3 },
        { header: "VENDOR", width: 0.3 },
        { header: "TOOL CODE", width: 0.4 },
      ],
      rows,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
