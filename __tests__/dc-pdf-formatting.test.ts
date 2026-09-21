import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { renderDcPdf, wrapCellText, type DcPdfData } from "../src/services/dc-pdf";

describe("Delivery Challan PDF Renderer & Text Wrapping", () => {
  it("renders a complete PDF buffer with standard DC fields and signature blocks", async () => {
    const pdfData: DcPdfData = {
      company: {
        name: "Vijay Spheroidals Pvt Ltd",
        address: "Plot 42, Peenya Industrial Estate, Bengaluru - 560058",
        gst: "29AAAAA0000A1Z5",
        contact: "+91 80 28390000 | info@vijayspheroidals.com",
      },
      logo: null,
      preparedByName: "Ramesh Kumar",
      approvedByName: "Aravind Gurudev",
      dcNumber: "DC-2026-00100",
      dcDate: "27/08/2026",
      woNumber: "WO-998822",
      status: "APPROVED",
      vendorName: "Precision Machining Works",
      vendorAddress: "Industrial Suburb, Rajajinagar, Bengaluru",
      vendorGst: "29BBBBB1111B1Z2",
      vendorPan: "BBBBB1111B",
      purpose: "JOB_WORK",
      processName: "CNC Turning & Boring",
      partNumber: "PART-VJS-9901",
      rmQuantity: "150.000",
      returnFgQuantity: "148.500",
      weightKg: "152.750 KG",
      heatNumber: "HEAT-2026-X9",
      remarks: "Special instructions: Handle with care. Process as per drawing rev 4.",
      vehicleNumber: "KA-04-MN-5678",
      transporter: "VRL Logistics",
      ewayBillNumber: "EWB-123456789012",
      eSugamNumber: "ESG-987654",
      referenceNumber: "REF-2026-08",
      expectedReturnDate: "05/09/2026",
      qrDataUrl: null,
    };

    const pdfBuffer = await renderDcPdf(pdfData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("wraps extreme cell values without overflow, preserving full content", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 8.5;
    const maxWidth = 100; // Constrained 100pt cell

    const testCases = [
      { id: "1", input: "H-101" },
      { id: "2", input: "HEAT-101, HEAT-102, HEAT-103, HEAT-104" },
      { id: "3", input: "HEAT-1234567890-ABCDEF-9876543210" },
      { id: "4", input: "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz" },
      { id: "5", input: "12345678901234567890123456789012345678901234567890" },
      { id: "6", input: "PART-VERY-LONG-NUMBER-WITHOUT-SPACES-12345678901234567890" },
      { id: "7", input: "WO-EXTREMELY-LONG-NUMBER-9999999999999999999999999" },
      { id: "8", input: "VIJAY-EXPRESS-LOGISTICS-AND-FREIGHT-CARRIERS-INDIA-PRIVATE-LIMITED" },
    ];

    for (const tc of testCases) {
      const lines = wrapCellText(tc.input, font, fontSize, maxWidth);
      expect(lines.length).toBeGreaterThan(0);

      // Verify no line exceeds maxWidth
      for (const line of lines) {
        const lineW = font.widthOfTextAtSize(line, fontSize);
        expect(lineW).toBeLessThanOrEqual(maxWidth);
      }

      // Verify no data truncation (all characters or words preserved)
      const reconstructed = lines.join(" ").replace(/\s+/g, "");
      const originalClean = tc.input.replace(/\s+/g, "");
      expect(reconstructed).toBe(originalClean);
    }
  });

  it("renders a PDF with extreme long values across all constrained fields cleanly", async () => {
    const pdfData: DcPdfData = {
      company: {
        name: "Vijay Spheroidals Pvt Ltd Company With Very Long Title",
        address: "Plot 42, Peenya Industrial Estate Phase 2, Near Water Tank, Bengaluru Karnataka 560058 India",
        gst: "29AAAAA0000A1Z5",
        contact: "+91 80 28390000 | info@vijayspheroidals.com",
      },
      logo: null,
      preparedByName: "Ramesh Kumar Long Name Engineer",
      approvedByName: "Aravind Gurudev Managing Director",
      dcNumber: "DC-2026-00100-EXTREMELY-LONG-NUMBER",
      dcDate: "27/08/2026",
      woNumber: "WO-998822-123456789012345678901234567890",
      status: "APPROVED",
      vendorName: "Precision Machining Works & Advanced Heavy Engineering Private Limited Corporation",
      vendorAddress: "Industrial Suburb 4th Cross Road 2nd Stage Peenya Rajajinagar Bengaluru Karnataka India 560010",
      vendorGst: "29BBBBB1111B1Z2",
      vendorPan: "BBBBB1111B",
      purpose: "JOB_WORK_SPECIAL_SURFACE_TREATMENT_AND_HEAT_PROCESSING",
      processName: "CNC Turning, Boring, Milling, Grinding & Nitriding Processing Phase 2",
      partNumber: "PART-VERY-LONG-NUMBER-WITHOUT-SPACES-12345678901234567890",
      rmQuantity: "150000.000 KG / 50000.000 NOS (RAW MATERIAL INWARD)",
      returnFgQuantity: "148500.000 KG / 49500.000 NOS (FINISHED GOODS RETURN)",
      weightKg: "999999999.999999-EXTREMELY-LONG-UNBROKEN-WEIGHT-VALUE-KG",
      heatNumber: "HEAT-1234567890-ABCDEF-9876543210, HEAT-99999-XXXXX-88888",
      remarks: "Special instructions: Handle with extreme care. UnbrokenStringCheck_abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz. Process as per drawing rev 4.",
      vehicleNumber: "KA-04-MN-5678-CONTAINER-TRUCK",
      transporter: "VIJAY-EXPRESS-LOGISTICS-AND-FREIGHT-CARRIERS-INDIA-PRIVATE-LIMITED",
      ewayBillNumber: "EWB-123456789012345678901234567890",
      eSugamNumber: "ESG-9876543210-REF-9999",
      referenceNumber: "REF-2026-08-LONG-SPEC-REF",
      expectedReturnDate: "05/09/2026",
      qrDataUrl: null,
    };

    const pdfBuffer = await renderDcPdf(pdfData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
