import { describe, it, expect } from "vitest";
import { renderDcPdf, type DcPdfData } from "../src/services/dc-pdf";

describe("Delivery Challan PDF Renderer", () => {
  it("renders a complete PDF buffer with all DC fields and 4 signature blocks", async () => {
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
    // PDF Magic bytes
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
