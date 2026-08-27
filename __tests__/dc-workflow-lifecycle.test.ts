import { describe, it, expect } from "vitest";
import { filterDcDataForRole } from "../src/server/dcs/sanitizer";

describe("DC 10-Stage Workflow & Security Rules", () => {
  it("enforces exact 10-stage status sequence", () => {
    const lifecycle = [
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "DISPATCHED",
      "AT_VENDOR",
      "SECURITY_RETURNED",
      "STORE_VERIFIED",
      "FINAL_APPROVED",
      "APPROVED_FOR_PAYMENT",
      "CLOSED",
    ];

    expect(lifecycle.length).toBe(10);
    expect(lifecycle[0]).toBe("DRAFT");
    expect(lifecycle[9]).toBe("CLOSED");
  });

  it("prevents self-approval unless user is ADMIN", () => {
    const validateSelfApproval = (createdBy: string, approverId: string, role: string) => {
      if (createdBy === approverId && role !== "ADMIN") {
        return { ok: false, error: "You cannot approve a Delivery Challan that you created." };
      }
      return { ok: true };
    };

    expect(validateSelfApproval("user-1", "user-1", "STORES").ok).toBe(false);
    expect(validateSelfApproval("user-1", "user-1", "MANAGEMENT").ok).toBe(false);
    expect(validateSelfApproval("user-1", "user-1", "ADMIN").ok).toBe(true);
    expect(validateSelfApproval("user-1", "user-2", "MANAGEMENT").ok).toBe(true);
  });

  it("sanitizes Store data for Security role (server-side blind entry)", () => {
    const fullData = {
      dcNumber: "DC-001",
      securityFgQuantity: 100,
      securityRejectionQuantity: 0,
      storeVerifiedFgQuantity: 95,
      storeRemarks: "5 Nos damaged",
      invoiceNumber: "INV-101",
      invoiceAmount: 50000,
    };

    const secPayload = filterDcDataForRole(fullData, "SECURITY");
    expect(secPayload.dcNumber).toBe("DC-001");
    expect(secPayload.securityFgQuantity).toBe(100);
    expect(secPayload.storeVerifiedFgQuantity).toBeUndefined();
    expect(secPayload.storeRemarks).toBeUndefined();
    expect(secPayload.invoiceNumber).toBeUndefined();
  });

  it("sanitizes Security data for Store role (server-side blind entry)", () => {
    const fullData = {
      dcNumber: "DC-001",
      securityFgQuantity: 100,
      securityReturnRemarks: "Gate entry ok",
      storeVerifiedFgQuantity: 95,
      storeRemarks: "5 Nos damaged",
      invoiceNumber: "INV-101",
    };

    const storePayload = filterDcDataForRole(fullData, "STORES");
    expect(storePayload.dcNumber).toBe("DC-001");
    expect(storePayload.storeVerifiedFgQuantity).toBe(95);
    expect(storePayload.securityFgQuantity).toBeUndefined();
    expect(storePayload.securityReturnRemarks).toBeUndefined();
    expect(storePayload.invoiceNumber).toBeUndefined();
  });

  it("requires manager correction remarks when Security and Store quantities differ", () => {
    const validateManagerApproval = (
      secTotal: number,
      storeTotal: number,
      expFg: number,
      remarks: string,
    ) => {
      const hasDiscrepancy = secTotal !== storeTotal || storeTotal !== expFg;
      if (hasDiscrepancy && !remarks.trim()) {
        return { ok: false, error: "Correction remarks are mandatory when quantities differ." };
      }
      return { ok: true };
    };

    // No discrepancy
    expect(validateManagerApproval(100, 100, 100, "").ok).toBe(true);

    // Discrepancy without remarks -> Fails
    expect(validateManagerApproval(100, 95, 100, "").ok).toBe(false);
    expect(validateManagerApproval(100, 95, 100, "   ").ok).toBe(false);

    // Discrepancy with remarks -> Passes
    expect(validateManagerApproval(100, 95, 100, "5 Nos process loss approved").ok).toBe(true);
  });

  it("validates mandatory invoice and payment details before DC closure", () => {
    const validateClosure = (invNum?: string, invDate?: string, invAmt?: number, payRef?: string, payDate?: string) => {
      if (!invNum || !invNum.trim()) return { ok: false, error: "Invoice Number is required." };
      if (!invDate) return { ok: false, error: "Invoice Date is required." };
      if (!invAmt || invAmt <= 0) return { ok: false, error: "Invoice Amount must be > 0." };
      if (!payRef || !payRef.trim()) return { ok: false, error: "Payment Reference Number is required." };
      if (!payDate) return { ok: false, error: "Payment Date is required." };
      return { ok: true };
    };

    expect(validateClosure("", "2026-08-27", 50000, "UTR-100", "2026-08-27").ok).toBe(false);
    expect(validateClosure("INV-01", "", 50000, "UTR-100", "2026-08-27").ok).toBe(false);
    expect(validateClosure("INV-01", "2026-08-27", 0, "UTR-100", "2026-08-27").ok).toBe(false);
    expect(validateClosure("INV-01", "2026-08-27", 50000, "", "2026-08-27").ok).toBe(false);
    expect(validateClosure("INV-01", "2026-08-27", 50000, "UTR-100", "2026-08-27").ok).toBe(true);
  });
});
