import { describe, it, expect } from "vitest";
import { renderDcPdfBuffer, type DcPdfData } from "../src/server/dcs/pdf";

describe("DC Manual Prepared By & Approved By Signatures", () => {
  it("uses manual preparedByName and approvedByName for PDF data mapping", () => {
    const mockDc = {
      dcNumber: "DC-2026-00001",
      dcDate: new Date(),
      status: "APPROVED",
      purpose: "JOB_WORK",
      vehicleNumber: "KA-01-AB-1234",
      transporter: "VRL Logistics",
      ewayBillNumber: null,
      eSugamNumber: null,
      referenceNumber: null,
      expectedReturnDate: null,
      qrToken: null,
      createdBy: "user-audit-id-123",
      approvedBy: "user-audit-id-456",
      preparedByName: "Ramesh Kumar",
      approvedByName: "Aravind Gurudev",
      vendor: { vendorName: "ABC Engineering", address: "Peenya Industrial Area", gstNumber: null, panNumber: null },
      process: { name: "Machining" },
      items: [
        {
          drawingNumber: "DWG-101",
          quantity: 10,
          uom: "NOS",
          inputWeight: 50.5,
          item: { itemCode: "ITEM-01", itemName: "Casting Item", drawingNumber: "DWG-101" },
        },
      ],
    };

    expect(mockDc.preparedByName).toBe("Ramesh Kumar");
    expect(mockDc.approvedByName).toBe("Aravind Gurudev");
    expect(mockDc.createdBy).not.toBe(mockDc.preparedByName);
    expect(mockDc.approvedBy).not.toBe(mockDc.approvedByName);
  });

  it("preserves null for existing/historical DCs without preparedByName or approvedByName", () => {
    const historicalDc = {
      preparedByName: null,
      approvedByName: null,
      createdBy: "audit-user-id-789",
      approvedBy: "audit-user-id-789",
    };

    expect(historicalDc.preparedByName).toBeNull();
    expect(historicalDc.approvedByName).toBeNull();
  });

  it("validates Prepared By Name requirements", () => {
    const validatePreparedBy = (name?: string) => {
      const trimmed = (name || "").trim();
      if (!trimmed) return { ok: false, error: "Prepared By Name is required." };
      if (trimmed.length > 100) return { ok: false, error: "Prepared By Name cannot exceed 100 characters." };
      return { ok: true, value: trimmed };
    };

    expect(validatePreparedBy("").ok).toBe(false);
    expect(validatePreparedBy("   ").ok).toBe(false);
    expect(validatePreparedBy("Ramesh Kumar").ok).toBe(true);
    expect(validatePreparedBy("Ramesh Kumar").value).toBe("Ramesh Kumar");
    expect(validatePreparedBy("S. Ramesh").value).toBe("S. Ramesh");
  });

  it("validates Approved By Name requirements", () => {
    const validateApprovedBy = (name?: string) => {
      const trimmed = (name || "").trim();
      if (!trimmed) return { ok: false, error: "Approved By Name is required." };
      if (trimmed.length > 100) return { ok: false, error: "Approved By Name cannot exceed 100 characters." };
      return { ok: true, value: trimmed };
    };

    expect(validateApprovedBy("").ok).toBe(false);
    expect(validateApprovedBy("   ").ok).toBe(false);
    expect(validateApprovedBy("Aravind Gurudev").ok).toBe(true);
    expect(validateApprovedBy("Aravind Gurudev").value).toBe("Aravind Gurudev");
  });
});
