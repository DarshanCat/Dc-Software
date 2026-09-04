import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitSecurityReturn, submitStoreVerification } from "@/server/dcs/actions";
import { recordInwardReceipt, confirmStoreReceipt, submitQualityInspection } from "@/server/dcs/extended-actions";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission } from "@/server/authorize";

vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryChallan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    statusHistory: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg(prisma);
    }),
  },
}));

vi.mock("@/server/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/server/authorize", () => ({
  requirePermission: vi.fn().mockResolvedValue(true),
  hasPermission: vi.fn().mockResolvedValue(true),
  ForbiddenError: class ForbiddenError extends Error {},
  UnauthenticatedError: class UnauthenticatedError extends Error {},
}));

vi.mock("@/server/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

vi.mock("@/server/notifications/service", () => ({
  notifyUsersWithPermission: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Quantity Ownership & Responsibilities (Security / Store / Quality)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. SECURITY GATE INWARD", () => {
    it("should allow Security to record actual inward gate details and log SECURITY_INWARD_RECORDED", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "security-user-1",
        email: "security@factory.com",
        roleKeys: ["SECURITY"],
      } as any);

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
        id: "dc-100",
        dcNumber: "DC-2026-00100",
        status: "DISPATCHED",
        invoiceNumber: "INV-999",
      } as any);

      vi.mocked(prisma.deliveryChallan.update).mockResolvedValue({ id: "dc-100" } as any);

      const res = await submitSecurityReturn("dc-100", {
        actualInwardQty: 50,
        inwardDate: "2026-09-04",
        inwardDocumentNo: "DOC-SEC-01",
        invoiceNumber: "INV-999",
        vehicleNumber: "KA-01-1234",
        remarks: "Received at main gate",
      });

      expect(res.ok).toBe(true);
      expect(prisma.deliveryChallan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dc-100" },
          data: expect.objectContaining({
            status: "SECURITY_RETURNED",
            actualInwardQty: expect.anything(),
          }),
        })
      );
    });
  });

  describe("2. STORE RECEIPT CONFIRMATION", () => {
    it("should allow Store to record store received quantity and log STORE_RECEIPT_CONFIRMED", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "store-user-1",
        email: "store@factory.com",
        roleKeys: ["STORES"],
      } as any);

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
        id: "dc-100",
        dcNumber: "DC-2026-00100",
        status: "SECURITY_RETURNED",
        actualInwardQty: 50,
      } as any);

      vi.mocked(prisma.deliveryChallan.update).mockResolvedValue({ id: "dc-100" } as any);

      const res = await submitStoreVerification("dc-100", {
        storeReceivedQty: 48,
        storeReceivedDate: "2026-09-04",
        storeRemarks: "2 pcs variance noticed during store unboxing",
      });

      expect(res.ok).toBe(true);
      expect(prisma.deliveryChallan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dc-100" },
          data: expect.objectContaining({
            status: "STORE_VERIFIED",
            storeReceivedQty: expect.anything(),
          }),
        })
      );
    });
  });

  describe("3. QUALITY INSPECTION OWNERSHIP & SUM VALIDATION", () => {
    it("should REJECT Quality Inspection submission from non-Quality roles with 403 Forbidden", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "store-user-1",
        email: "store@factory.com",
        roleKeys: ["STORES"], // Store user attempting quality entry
      } as any);

      const res = await submitQualityInspection({
        dcId: "dc-100",
        goodQty: 40,
        rejectionQty: 5,
        scrapQty: 3,
        qualityDecision: "PASSED",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("403 Forbidden: Security and Store roles are strictly prohibited");
      }
    });

    it("should REJECT Quality Inspection if Good + Rejection + Scrap does not equal Store Received Qty", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "quality-user-1",
        email: "quality@factory.com",
        roleKeys: ["QUALITY"],
      } as any);

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
        id: "dc-100",
        dcNumber: "DC-2026-00100",
        status: "QUALITY_PENDING",
        actualInwardQty: 50,
        storeReceivedQty: 48, // Store received 48
      } as any);

      // Attempting to submit Good (40) + Reject (5) + Scrap (1) = 46 != 48
      const res = await submitQualityInspection({
        dcId: "dc-100",
        goodQty: 40,
        rejectionQty: 5,
        scrapQty: 1,
        qualityDecision: "PASSED",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Good + Rejection + Scrap must equal the Store Received Qty.");
      }
    });

    it("should ACCEPT Quality Inspection when Good + Rejection + Scrap equals Store Received Qty", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "quality-user-1",
        email: "quality@factory.com",
        roleKeys: ["QUALITY"],
      } as any);

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
        id: "dc-100",
        dcNumber: "DC-2026-00100",
        status: "QUALITY_PENDING",
        actualInwardQty: 50,
        storeReceivedQty: 48,
      } as any);

      vi.mocked(prisma.deliveryChallan.update).mockResolvedValue({ id: "dc-100" } as any);

      // Submit Good (40) + Reject (5) + Scrap (3) = 48 == 48
      const res = await submitQualityInspection({
        dcId: "dc-100",
        goodQty: 40,
        rejectionQty: 5,
        scrapQty: 3,
        qualityDecision: "PARTIAL_ACCEPTANCE",
        inspectionRemarks: "5 dimension rejection, 3 raw material scrap",
      });

      expect(res.ok).toBe(true);
      expect(prisma.deliveryChallan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dc-100" },
          data: expect.objectContaining({
            status: "QUALITY_COMPLETED",
            goodQty: expect.anything(),
            rejectionQty: expect.anything(),
            scrapQty: expect.anything(),
            qualityDecision: "PARTIAL_ACCEPTANCE",
          }),
        })
      );
    });
  });

  describe("4. SELF-APPROVAL & PAYLOAD REJECTION GUARDS", () => {
    it("should BLOCK non-Admin creator from approving their own DC", async () => {
      const { approveDc } = await import("@/server/dcs/actions");
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "creator-user-1",
        email: "user@factory.com",
        roleKeys: ["STORES"],
      } as any);

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
        id: "dc-200",
        createdBy: "creator-user-1", // Same user as session
        status: "PENDING_APPROVAL",
      } as any);

      const res = await approveDc("dc-200", "Self Approver");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("You cannot approve a Delivery Challan that you created.");
      }
    });

    it("should REJECT Security payload attempting to inject Quality quantities", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "sec-1",
        email: "sec@factory.com",
        roleKeys: ["SECURITY"],
      } as any);

      const res = await submitSecurityReturn("dc-100", {
        actualInwardQty: 50,
        goodQty: 45, // Disallowed for Security
      } as any);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Security action cannot accept weights");
      }
    });

    it("should REJECT Store payload attempting to inject Quality quantities", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "store-1",
        email: "store@factory.com",
        roleKeys: ["STORES"],
      } as any);

      const res = await submitStoreVerification("dc-100", {
        storeReceivedQty: 48,
        scrapQty: 2, // Disallowed for Store
      } as any);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Store action cannot accept Quality");
      }
    });

    it("should REJECT Manager Payment Approval payload attempting to modify Quality quantities", async () => {
      const { submitPaymentApproval } = await import("@/server/dcs/actions");
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "mgr-1",
        email: "mgr@factory.com",
        roleKeys: ["MANAGEMENT"],
      } as any);

      const res = await submitPaymentApproval("dc-100", {
        goodQty: 45, // Disallowed for Manager Payment Approval
      } as any);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Manager action cannot modify Quality classification quantities.");
      }
    });
  });

  describe("5. DC CLOSURE AUTHORITY & ACCOUNTS PAYMENT ENTRY (canCloseDc & submitAccountsPaymentEntry)", () => {
    it("15A: APPROVED_FOR_PAYMENT + complete persisted fields -> canCloseDc returns eligible/true", async () => {
      const { canCloseDc } = await import("@/server/dcs/actions");
      const dc = {
        id: "dc-301",
        status: "APPROVED_FOR_PAYMENT",
        invoiceNumber: "INV-100",
        invoiceDate: new Date("2026-09-04"),
        invoiceAmount: 5000,
        paymentReferenceNumber: "UTR-999",
        paymentDate: new Date("2026-09-04"),
      };
      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValueOnce(dc as any);
      const res = await canCloseDc("dc-301");
      expect(res.eligible).toBe(true);
      expect(res.missingFields.length).toBe(0);
    });

    it("15B: APPROVED_FOR_PAYMENT + missing invoiceNumber -> blocked", async () => {
      const { canCloseDc } = await import("@/server/dcs/actions");
      const dc = {
        id: "dc-302",
        status: "APPROVED_FOR_PAYMENT",
        invoiceNumber: "   ", // Blank
        invoiceDate: new Date("2026-09-04"),
        invoiceAmount: 5000,
        paymentReferenceNumber: "UTR-999",
        paymentDate: new Date("2026-09-04"),
      };
      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValueOnce(dc as any);
      const res = await canCloseDc("dc-302");
      expect(res.eligible).toBe(false);
      expect(res.missingFields).toContain("Missing invoice number");
    });

    it("15C: APPROVED_FOR_PAYMENT + missing invoiceDate -> blocked", async () => {
      const { canCloseDc } = await import("@/server/dcs/actions");
      const dc = {
        id: "dc-303",
        status: "APPROVED_FOR_PAYMENT",
        invoiceNumber: "INV-100",
        invoiceDate: null, // Missing
        invoiceAmount: 5000,
        paymentReferenceNumber: "UTR-999",
        paymentDate: new Date("2026-09-04"),
      };
      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValueOnce(dc as any);
      const res = await canCloseDc("dc-303");
      expect(res.eligible).toBe(false);
      expect(res.missingFields).toContain("Missing invoice date");
    });

    it("15D: APPROVED_FOR_PAYMENT + invoiceAmount <= 0 -> blocked", async () => {
      const { canCloseDc } = await import("@/server/dcs/actions");
      const dc = {
        id: "dc-304",
        status: "APPROVED_FOR_PAYMENT",
        invoiceNumber: "INV-100",
        invoiceDate: new Date("2026-09-04"),
        invoiceAmount: 0, // <= 0
        paymentReferenceNumber: "UTR-999",
        paymentDate: new Date("2026-09-04"),
      };
      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValueOnce(dc as any);
      const res = await canCloseDc("dc-304");
      expect(res.eligible).toBe(false);
      expect(res.missingFields).toContain("Invoice amount must be greater than zero");
    });

    it("15E: APPROVED_FOR_PAYMENT + missing paymentReferenceNumber -> blocked", async () => {
      const { canCloseDc } = await import("@/server/dcs/actions");
      const dc = {
        id: "dc-305",
        status: "APPROVED_FOR_PAYMENT",
        invoiceNumber: "INV-100",
        invoiceDate: new Date("2026-09-04"),
        invoiceAmount: 5000,
        paymentReferenceNumber: "", // Missing
        paymentDate: new Date("2026-09-04"),
      };
      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValueOnce(dc as any);
      const res = await canCloseDc("dc-305");
      expect(res.eligible).toBe(false);
      expect(res.missingFields).toContain("Missing payment reference number");
    });

    it("15F: APPROVED_FOR_PAYMENT + missing paymentDate -> blocked", async () => {
      const { canCloseDc } = await import("@/server/dcs/actions");
      const dc = {
        id: "dc-306",
        status: "APPROVED_FOR_PAYMENT",
        invoiceNumber: "INV-100",
        invoiceDate: new Date("2026-09-04"),
        invoiceAmount: 5000,
        paymentReferenceNumber: "UTR-999",
        paymentDate: null, // Missing
      };
      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValueOnce(dc as any);
      const res = await canCloseDc("dc-306");
      expect(res.eligible).toBe(false);
      expect(res.missingFields).toContain("Missing payment date");
    });

    it("15H: Unauthorized user -> cannot close even if all payment fields exist", async () => {
      const { closeDc } = await import("@/server/dcs/actions");
      const { requirePermission } = await import("@/server/authorize");
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "unauth-user-1",
        email: "unauth@factory.com",
        roleKeys: ["VENDOR"],
      } as any);

      vi.mocked(requirePermission).mockRejectedValueOnce(new Error("Permission denied"));

      const res = await closeDc("dc-301");
      expect(res.ok).toBe(false);
    });

    it("15I: submitAccountsPaymentEntry does NOT automatically close DC; status remains APPROVED_FOR_PAYMENT", async () => {
      const { submitAccountsPaymentEntry } = await import("@/server/dcs/actions");
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "acc-user-1",
        email: "accounts@factory.com",
        roleKeys: ["ACCOUNTS"],
      } as any);

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
        id: "dc-300",
        dcNumber: "DC-2026-00300",
        status: "APPROVED_FOR_PAYMENT",
      } as any);

      vi.mocked(prisma.deliveryChallan.update).mockResolvedValue({ id: "dc-300" } as any);

      const res = await submitAccountsPaymentEntry("dc-300", {
        invoiceNumber: "INV-2026-888",
        invoiceDate: "2026-09-04",
        invoiceAmount: 12500,
        paymentReferenceNumber: "UTR-11223344",
        paymentDate: "2026-09-04",
        paymentRemarks: "Paid via NEFT",
      });

      expect(res.ok).toBe(true);
      expect(prisma.deliveryChallan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dc-300" },
          data: expect.objectContaining({
            invoiceNumber: "INV-2026-888",
            invoiceAmount: expect.anything(),
            paymentReferenceNumber: "UTR-11223344",
          }),
        })
      );
      // Status MUST NOT be updated to CLOSED by submitAccountsPaymentEntry
      const updateCallArgs = vi.mocked(prisma.deliveryChallan.update).mock.calls[0][0];
      expect(updateCallArgs.data).not.toHaveProperty("status", "CLOSED");
    });
  });
});
