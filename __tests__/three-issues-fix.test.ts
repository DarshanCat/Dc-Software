import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderDcPdf, type DcPdfData } from "../src/services/dc-pdf";
import { deleteTestDc } from "../src/server/dcs/extended-actions";
import { prisma } from "../src/lib/db";
import { getSessionUser } from "../src/server/session";

vi.mock("../src/lib/db", () => ({
  prisma: {
    deliveryChallan: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    deliveryChallanItem: {
      deleteMany: vi.fn(),
    },
    statusHistory: {
      deleteMany: vi.fn(),
    },
    document: {
      deleteMany: vi.fn(),
    },
    systemSetting: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

vi.mock("../src/server/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Three Issues Fix — PDF Heat Number, Vendor Fallback & Safe Test DC Deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePdfData: DcPdfData = {
    company: {
      name: "Vijay Spheroidals Pvt Ltd",
      address: "Peenya Industrial Area, Bengaluru",
      gst: "29AAAAA0000A1Z5",
      contact: "info@vijayspheroidals.com",
    },
    dcNumber: "DC-2026-00001",
    dcDate: "16/09/2026",
    woNumber: "WO-101",
    status: "DRAFT",
    vendorName: "Test Supplier",
    vendorAddress: "Bengaluru",
    vendorGst: "29GST123",
    vendorPan: "PAN123",
    purpose: "JOB_WORK",
    processName: "Machining",
    partNumber: "PART-001",
    rmQuantity: "10.000",
    returnFgQuantity: "10.000",
    heatNumber: "H-101",
    vehicleNumber: "KA-01-1234",
    transporter: "Self",
    ewayBillNumber: "EWB123",
    eSugamNumber: "ESG123",
    referenceNumber: "REF123",
    expectedReturnDate: "20/09/2026",
    qrDataUrl: null,
  };

  describe("Issue 1: PDF Heat Number Rendering", () => {
    it("renders short heat number (H-101) cleanly", async () => {
      const pdf = await renderDcPdf({ ...basePdfData, heatNumber: "H-101" });
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    });

    it("renders long hyphenated heat number cleanly with text wrapping", async () => {
      const pdf = await renderDcPdf({
        ...basePdfData,
        heatNumber: "HEAT-1234567890-ABCDEF-9876543210",
      });
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    });

    it("renders multiple comma-separated heat numbers cleanly with text wrapping", async () => {
      const pdf = await renderDcPdf({
        ...basePdfData,
        heatNumber: "HEAT-101, HEAT-102, HEAT-103, HEAT-104",
      });
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    });
  });

  describe("Issue 2: Supplier Master Synchronization & Vendor Priority", () => {
    it("prefers current vendor relation name over supplierNameSnapshot when vendor exists", async () => {
      const mockDc = {
        id: "dc-vendor-sync-01",
        dcNumber: "DC-2026-00099",
        dcDate: new Date(),
        status: "DRAFT",
        purpose: "JOB_WORK",
        woNumber: "WO-888",
        partNumber: "PART-888",
        rmQuantity: 10,
        returnFgQuantity: 10,
        heatNumber: "H-888",
        remarks: null,
        vehicleNumber: null,
        transporter: null,
        ewayBillNumber: null,
        eSugamNumber: null,
        referenceNumber: null,
        expectedReturnDate: null,
        qrToken: null,
        createdBy: "user-1",
        approvedBy: null,
        preparedByName: "Tester",
        approvedByName: null,
        supplierNameSnapshot: "OLD VENDOR NAME",
        supplierAddressSnapshot: "Old Address",
        supplierGstSnapshot: "29OLDGST",
        vendor: {
          vendorName: "NEW UPDATED VENDOR NAME",
          address: "New Address",
          gstNumber: "29NEWGST",
          panNumber: "NEWPAN123",
        },
        process: { name: "Machining" },
      };

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDc as any);

      const { loadDcPdfData } = await import("../src/server/dcs/pdf");
      const pdfData = await loadDcPdfData("dc-vendor-sync-01");

      expect(pdfData).not.toBeNull();
      if (pdfData) {
        expect(pdfData.vendorName).toBe("NEW UPDATED VENDOR NAME");
        expect(pdfData.vendorAddress).toBe("New Address");
        expect(pdfData.vendorGst).toBe("29NEWGST");
      }
    });

    it("falls back to supplierNameSnapshot when vendor relation is null", async () => {
      const mockDcNoVendor = {
        id: "dc-vendor-sync-02",
        dcNumber: "DC-2026-00098",
        dcDate: new Date(),
        status: "DRAFT",
        purpose: "JOB_WORK",
        woNumber: "WO-777",
        partNumber: "PART-777",
        rmQuantity: 10,
        returnFgQuantity: 10,
        heatNumber: "H-777",
        remarks: null,
        vehicleNumber: null,
        transporter: null,
        ewayBillNumber: null,
        eSugamNumber: null,
        referenceNumber: null,
        expectedReturnDate: null,
        qrToken: null,
        createdBy: "user-1",
        approvedBy: null,
        preparedByName: "Tester",
        approvedByName: null,
        supplierNameSnapshot: "SNAPSHOT VENDOR NAME",
        supplierAddressSnapshot: "Snapshot Address",
        supplierGstSnapshot: "29SNAPSHOTGST",
        vendor: null,
        process: { name: "Machining" },
      };

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDcNoVendor as any);

      const { loadDcPdfData } = await import("../src/server/dcs/pdf");
      const pdfData = await loadDcPdfData("dc-vendor-sync-02");

      expect(pdfData).not.toBeNull();
      if (pdfData) {
        expect(pdfData.vendorName).toBe("SNAPSHOT VENDOR NAME");
        expect(pdfData.vendorAddress).toBe("Snapshot Address");
        expect(pdfData.vendorGst).toBe("29SNAPSHOTGST");
      }
    });
  });

  describe("Issue 3: Safe Admin Test/Sample DC Deletion", () => {
    it("rejects deletion for non-ADMIN user", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "user-1",
        email: "stores@example.com",
        roleKeys: ["STORES"],
      } as any);

      const res = await deleteTestDc("dc-123");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("403 Forbidden");
      }
    });

    it("rejects deletion if DC is not explicitly marked as TEST or SAMPLE", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        roleKeys: ["ADMIN"],
      } as any);

      const mockDc = {
        id: "dc-real-001",
        dcNumber: "DC-2026-00001",
        status: "DRAFT",
        purpose: "JOB_WORK",
        remarks: "Regular production job work",
        dispatch: null,
        receipts: [],
        scrapReceipts: [],
        reconciliation: null,
        exceptions: [],
        recoveryRequirements: [],
        recoveryReceipts: [],
        classifications: [],
        statusHistory: [],
      };

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDc as any);

      const res = await deleteTestDc("dc-real-001");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("not explicitly marked as a TEST or SAMPLE record");
      }
    });

    it("rejects deletion for operational/completed status even if marked as SAMPLE", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        roleKeys: ["ADMIN"],
      } as any);

      const mockDc = {
        id: "dc-sample-operational",
        dcNumber: "DC-2026-SAMPLE-01",
        status: "STORE_VERIFIED",
        purpose: "SAMPLE",
        remarks: "Test sample DC",
        dispatch: null,
        receipts: [],
        scrapReceipts: [],
        reconciliation: null,
        exceptions: [],
        recoveryRequirements: [],
        recoveryReceipts: [],
        classifications: [],
        statusHistory: [],
      };

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDc as any);

      const res = await deleteTestDc("dc-sample-operational");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Operational or completed DCs cannot be deleted");
      }
    });

    it("allows ADMIN to delete explicitly marked TEST/SAMPLE DC in early status", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        roleKeys: ["ADMIN"],
      } as any);

      const mockDc = {
        id: "dc-sample-draft",
        dcNumber: "DC-2026-SAMPLE-02",
        status: "DRAFT",
        purpose: "SAMPLE",
        remarks: "Demo test DC for verification",
        dispatch: null,
        receipts: [],
        scrapReceipts: [],
        reconciliation: null,
        exceptions: [],
        recoveryRequirements: [],
        recoveryReceipts: [],
        classifications: [],
        statusHistory: [],
      };

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDc as any);
      vi.mocked(prisma.deliveryChallanItem.deleteMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.statusHistory.deleteMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.document.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.deliveryChallan.delete).mockResolvedValue(mockDc as any);

      const res = await deleteTestDc("dc-sample-draft");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.dcId).toBe("dc-sample-draft");
      }
      expect(prisma.deliveryChallan.delete).toHaveBeenCalledWith({ where: { id: "dc-sample-draft" } });
    });
  });
});
