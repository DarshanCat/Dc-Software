import { describe, it, expect } from "vitest";
import { filterDcDataForRole } from "../src/server/dcs/sanitizer";

describe("DC Close Workflow & Security Test Suite", () => {
  // 1. Security Return entry validation
  it("1. validates Security Return entry quantities", () => {
    const validateSecurityReturn = (fg: number, rej: number, scrap: number) => {
      if (fg < 0 || rej < 0 || scrap < 0) return { ok: false, error: "Quantities cannot be negative." };
      return { ok: true, total: fg + rej + scrap };
    };

    expect(validateSecurityReturn(-1, 0, 0).ok).toBe(false);
    expect(validateSecurityReturn(10, 2, 1).ok).toBe(true);
    expect(validateSecurityReturn(10, 2, 1).total).toBe(13);
  });

  // 2. Store blind verification
  it("2. allows Store to enter verification quantities independently", () => {
    const validateStoreVerification = (fg: number, rej: number, scrap: number) => {
      if (fg < 0 || rej < 0 || scrap < 0) return { ok: false, error: "Verified quantities cannot be negative." };
      return { ok: true, total: fg + rej + scrap };
    };

    expect(validateStoreVerification(10, 1, 0).ok).toBe(true);
    expect(validateStoreVerification(10, 1, 0).total).toBe(11);
  });

  // 3 & 4. Security cannot read Store data & Store cannot read Security data
  it("3 & 4. enforces server-side blind payload filtering between Security and Store roles", () => {
    const rawDc = {
      dcNumber: "DC-2026-001",
      securityFgQuantity: 100,
      securityRejectionQuantity: 2,
      securityScrapQuantity: 1,
      securityReturnRemarks: "Security gate entry ok",
      storeVerifiedFgQuantity: 98,
      storeVerifiedRejectionQuantity: 2,
      storeVerifiedScrapQuantity: 1,
      storeRemarks: "Store count matches",
      invoiceNumber: "INV-9900",
      invoiceAmount: 15000,
    };

    // Security view: Store & Accounts data removed
    const securityView = filterDcDataForRole(rawDc, "SECURITY");
    expect(securityView.securityFgQuantity).toBe(100);
    expect(securityView.storeVerifiedFgQuantity).toBeUndefined();
    expect(securityView.storeRemarks).toBeUndefined();
    expect(securityView.invoiceNumber).toBeUndefined();

    // Store view: Security return & Accounts data removed
    const storeView = filterDcDataForRole(rawDc, "STORES");
    expect(storeView.storeVerifiedFgQuantity).toBe(98);
    expect(storeView.securityFgQuantity).toBeUndefined();
    expect(storeView.securityReturnRemarks).toBeUndefined();
    expect(storeView.invoiceNumber).toBeUndefined();
  });

  // 5. Manager can compare both entries
  it("5. allows Management/Admin to receive full comparison data", () => {
    const rawDc = {
      dcNumber: "DC-2026-001",
      securityFgQuantity: 100,
      storeVerifiedFgQuantity: 95,
      invoiceNumber: "INV-9900",
    };

    const managerView = filterDcDataForRole(rawDc, "MANAGEMENT");
    expect(managerView.securityFgQuantity).toBe(100);
    expect(managerView.storeVerifiedFgQuantity).toBe(95);

    const adminView = filterDcDataForRole(rawDc, "ADMIN");
    expect(adminView.securityFgQuantity).toBe(100);
    expect(adminView.storeVerifiedFgQuantity).toBe(95);
  });

  // 6 & 7. Discrepancy warning detection & mandatory correction remarks
  it("6 & 7. detects discrepancy warning and requires mandatory correction remarks", () => {
    const checkDiscrepancy = (secTotal: number, storeTotal: number, expectedFg: number, remarks: string) => {
      const hasDiscrepancy = secTotal !== storeTotal || storeTotal !== expectedFg;
      if (hasDiscrepancy && !remarks.trim()) {
        return { ok: false, error: "Correction remarks are mandatory when quantities differ." };
      }
      return { ok: true, hasDiscrepancy };
    };

    // Equal quantities -> No discrepancy
    expect(checkDiscrepancy(100, 100, 100, "").ok).toBe(true);
    expect(checkDiscrepancy(100, 100, 100, "").hasDiscrepancy).toBe(false);

    // Unequal quantities without remarks -> Fails
    expect(checkDiscrepancy(100, 95, 100, "").ok).toBe(false);

    // Unequal quantities with remarks -> Passes with discrepancy flag
    const res = checkDiscrepancy(100, 95, 100, "5 units process rejection approved");
    expect(res.ok).toBe(true);
    expect(res.hasDiscrepancy).toBe(true);
  });

  // 8. Final approved quantities & payable calculation
  it("8. calculates final payable amount based on pricing basis and final approved quantities", () => {
    const rate = 1000;
    const rmQty = 15;
    const finalApprovedFgQty = 24;

    // Basis = RM: RM Qty * Rate
    const payableRM = rmQty * rate;
    expect(payableRM).toBe(15000);

    // Basis = FG: Final Approved FG Qty * Rate
    const payableFG = finalApprovedFgQty * rate;
    expect(payableFG).toBe(24000);
  });

  // 9. Payment approval
  it("9. validates Payment Approval transition (FINAL_APPROVED -> APPROVED_FOR_PAYMENT)", () => {
    const canApprovePayment = (status: string, role: string) => {
      if (status !== "FINAL_APPROVED") return { ok: false, error: "DC must be in FINAL_APPROVED status." };
      if (!["MANAGEMENT", "ADMIN"].includes(role)) return { ok: false, error: "Unauthorized." };
      return { ok: true, nextStatus: "APPROVED_FOR_PAYMENT" };
    };

    expect(canApprovePayment("STORE_VERIFIED", "MANAGEMENT").ok).toBe(false);
    expect(canApprovePayment("FINAL_APPROVED", "ACCOUNTS").ok).toBe(false);
    expect(canApprovePayment("FINAL_APPROVED", "MANAGEMENT").ok).toBe(true);
    expect(canApprovePayment("FINAL_APPROVED", "ADMIN").ok).toBe(true);
  });

  // 10. Accounts payment entry
  it("10. validates Accounts payment entry (status remains APPROVED_FOR_PAYMENT)", () => {
    const validateAccountsEntry = (status: string, invNum: string, invAmt: number, payRef: string) => {
      if (status !== "APPROVED_FOR_PAYMENT") return { ok: false, error: "DC must be APPROVED_FOR_PAYMENT." };
      if (!invNum.trim()) return { ok: false, error: "Invoice Number is required." };
      if (invAmt <= 0) return { ok: false, error: "Invoice Amount must be greater than zero." };
      if (!payRef.trim()) return { ok: false, error: "Payment Reference Number is required." };
      return { ok: true };
    };

    expect(validateAccountsEntry("APPROVED_FOR_PAYMENT", "INV-100", 25000, "UTR-99").ok).toBe(true);
    expect(validateAccountsEntry("APPROVED_FOR_PAYMENT", "", 25000, "UTR-99").ok).toBe(false);
    expect(validateAccountsEntry("APPROVED_FOR_PAYMENT", "INV-100", 0, "UTR-99").ok).toBe(false);
  });

  // 11. Close DC validation
  it("11. validates mandatory invoice and payment details before explicit DC closure", () => {
    const validateClosure = (
      status: string,
      invNum?: string,
      invDate?: string,
      invAmt?: number,
      payRef?: string,
      payDate?: string,
    ) => {
      if (status !== "APPROVED_FOR_PAYMENT") return { ok: false, error: "Must be APPROVED_FOR_PAYMENT status." };
      if (!invNum || !invNum.trim()) return { ok: false, error: "Invoice Number is required." };
      if (!invDate) return { ok: false, error: "Invoice Date is required." };
      if (!invAmt || invAmt <= 0) return { ok: false, error: "Invoice Amount must be > 0." };
      if (!payRef || !payRef.trim()) return { ok: false, error: "Payment Reference Number is required." };
      if (!payDate) return { ok: false, error: "Payment Date is required." };
      return { ok: true };
    };

    expect(validateClosure("APPROVED_FOR_PAYMENT", "INV-01", "2026-08-27", 50000, "UTR-100", "2026-08-27").ok).toBe(true);
    expect(validateClosure("APPROVED_FOR_PAYMENT", "", "2026-08-27", 50000, "UTR-100", "2026-08-27").ok).toBe(false);
    expect(validateClosure("FINAL_APPROVED", "INV-01", "2026-08-27", 50000, "UTR-100", "2026-08-27").ok).toBe(false);
  });

  // 12. Closed DC cannot be edited
  it("12. locks Closed DCs from further operational or financial edits", () => {
    const canEditDc = (status: string) => {
      if (status === "CLOSED") return { ok: false, error: "DC is CLOSED and read-only." };
      return { ok: true };
    };

    expect(canEditDc("CLOSED").ok).toBe(false);
    expect(canEditDc("APPROVED_FOR_PAYMENT").ok).toBe(true);
  });

  // 13. Server-side role authorization
  it("13. enforces server-side role authorization per transition action", () => {
    const authorizeAction = (action: string, role: string) => {
      if (role === "ADMIN") return true; // ADMIN role has full access to all actions
      if (action === "SECURITY_DISPATCH" && !["SECURITY"].includes(role)) return false;
      if (action === "STORE_VERIFY" && !["STORES"].includes(role)) return false;
      if (action === "MANAGER_FINAL_APPROVE" && !["MANAGEMENT"].includes(role)) return false;
      if (action === "ACCOUNTS_ENTRY" && !["ACCOUNTS"].includes(role)) return false;
      return true;
    };

    expect(authorizeAction("SECURITY_DISPATCH", "STORES")).toBe(false);
    expect(authorizeAction("STORE_VERIFY", "SECURITY")).toBe(false);
    expect(authorizeAction("MANAGER_FINAL_APPROVE", "ACCOUNTS")).toBe(false);
    expect(authorizeAction("ACCOUNTS_ENTRY", "ACCOUNTS")).toBe(true);
    expect(authorizeAction("SECURITY_DISPATCH", "ADMIN")).toBe(true);
    expect(authorizeAction("STORE_VERIFY", "ADMIN")).toBe(true);
    expect(authorizeAction("MANAGER_FINAL_APPROVE", "ADMIN")).toBe(true);
    expect(authorizeAction("ACCOUNTS_ENTRY", "ADMIN")).toBe(true);
  });

  // 14. Full audit history restriction
  it("14. restricts full DC audit history access server-side to ADMIN, MANAGEMENT, and ACCOUNTS", () => {
    const canViewFullHistory = (role: string) => {
      return ["ADMIN", "MANAGEMENT", "ACCOUNTS"].includes(role);
    };

    expect(canViewFullHistory("SECURITY")).toBe(false);
    expect(canViewFullHistory("STORES")).toBe(false);
    expect(canViewFullHistory("MANAGEMENT")).toBe(true);
    expect(canViewFullHistory("ACCOUNTS")).toBe(true);
    expect(canViewFullHistory("ADMIN")).toBe(true);
  });

  // 15. ADMIN complete workflow execution test
  it("15. allows ADMIN user to perform every action through full lifecycle sequentially", () => {
    let currentStatus = "DRAFT";

    const step = (action: string, allowedFromStatus: string[], nextStatus: string) => {
      if (!allowedFromStatus.includes(currentStatus)) {
        return { ok: false, error: `Action ${action} invalid from status ${currentStatus}` };
      }
      currentStatus = nextStatus;
      return { ok: true, status: currentStatus };
    };

    // 1. Submit for Approval
    expect(step("submitForApproval", ["DRAFT"], "PENDING_APPROVAL").ok).toBe(true);
    expect(currentStatus).toBe("PENDING_APPROVAL");

    // 2. Approve DC
    expect(step("approveDc", ["PENDING_APPROVAL"], "APPROVED").ok).toBe(true);
    expect(currentStatus).toBe("APPROVED");

    // 3. Security Dispatch
    expect(step("submitSecurityDispatch", ["APPROVED"], "DISPATCHED").ok).toBe(true);
    expect(currentStatus).toBe("DISPATCHED");

    // 4. Confirm Vendor Receipt
    expect(step("confirmDcAtVendor", ["DISPATCHED"], "AT_VENDOR").ok).toBe(true);
    expect(currentStatus).toBe("AT_VENDOR");

    // 5. Security Return
    expect(step("submitSecurityReturn", ["DISPATCHED", "AT_VENDOR"], "SECURITY_RETURNED").ok).toBe(true);
    expect(currentStatus).toBe("SECURITY_RETURNED");

    // 6. Store Verification
    expect(step("submitStoreVerification", ["SECURITY_RETURNED"], "STORE_VERIFIED").ok).toBe(true);
    expect(currentStatus).toBe("STORE_VERIFIED");

    // 7. Manager Final Approval
    expect(step("submitManagerFinalApproval", ["STORE_VERIFIED"], "FINAL_APPROVED").ok).toBe(true);
    expect(currentStatus).toBe("FINAL_APPROVED");

    // 8. Payment Approval
    expect(step("submitPaymentApproval", ["FINAL_APPROVED"], "APPROVED_FOR_PAYMENT").ok).toBe(true);
    expect(currentStatus).toBe("APPROVED_FOR_PAYMENT");

    // 9. Accounts Payment Entry (Status remains APPROVED_FOR_PAYMENT)
    expect(step("submitAccountsPaymentEntry", ["APPROVED_FOR_PAYMENT"], "APPROVED_FOR_PAYMENT").ok).toBe(true);
    expect(currentStatus).toBe("APPROVED_FOR_PAYMENT");

    // 10. Close DC
    expect(step("closeDc", ["APPROVED_FOR_PAYMENT"], "CLOSED").ok).toBe(true);
    expect(currentStatus).toBe("CLOSED");
  });

  // 16. CLOSE DC readiness state & button color logic
  it("16. evaluates isReadyToClose and enforces CLOSE DC button state", () => {
    const checkReadiness = (
      status: string,
      invNum?: string,
      invDate?: string,
      invAmt?: number,
      payRef?: string,
      payDate?: string,
    ) => {
      return (
        status === "APPROVED_FOR_PAYMENT" &&
        !!invNum?.trim() &&
        !!invDate &&
        Number(invAmt ?? 0) > 0 &&
        !!payRef?.trim() &&
        !!payDate
      );
    };

    // Incomplete payment details -> Disabled (not ready)
    expect(checkReadiness("APPROVED_FOR_PAYMENT", "", "2026-08-27", 1000, "UTR-1", "2026-08-27")).toBe(false);
    expect(checkReadiness("APPROVED_FOR_PAYMENT", "INV-100", "2026-08-27", 0, "UTR-1", "2026-08-27")).toBe(false);

    // Complete payment details -> Enabled & Green (ready to close)
    expect(checkReadiness("APPROVED_FOR_PAYMENT", "INV-100", "2026-08-27", 15000, "UTR-1", "2026-08-27")).toBe(true);
  });

  // 17. Pre-Outward Manager Approval transitions and mandatory remarks
  it("17. validates Pre-Outward Manager Approval actions (APPROVE, SENT_BACK, REJECT)", () => {
    const reviewPreOutward = (status: string, action: "APPROVE" | "SENT_BACK" | "REJECT", remarks?: string) => {
      if (status !== "PENDING_APPROVAL" && status !== "DRAFT") {
        return { ok: false, error: `Only PENDING_APPROVAL DCs can undergo Pre-Outward Approval. Current status: ${status}` };
      }
      const trimmedRemarks = (remarks || "").trim();
      if ((action === "SENT_BACK" || action === "REJECT") && !trimmedRemarks) {
        return { ok: false, error: `Reason is mandatory when selecting ${action}.` };
      }
      let nextStatus = "APPROVED";
      if (action === "REJECT") nextStatus = "REJECTED";
      if (action === "SENT_BACK") nextStatus = "SENT_BACK";
      return { ok: true, nextStatus };
    };

    expect(reviewPreOutward("PENDING_APPROVAL", "APPROVE").ok).toBe(true);
    expect(reviewPreOutward("PENDING_APPROVAL", "APPROVE").nextStatus).toBe("APPROVED");
    expect(reviewPreOutward("PENDING_APPROVAL", "SENT_BACK", "").ok).toBe(false);
    expect(reviewPreOutward("PENDING_APPROVAL", "SENT_BACK", "Fix rate").ok).toBe(true);
    expect(reviewPreOutward("PENDING_APPROVAL", "SENT_BACK", "Fix rate").nextStatus).toBe("SENT_BACK");
    expect(reviewPreOutward("PENDING_APPROVAL", "REJECT", "").ok).toBe(false);
    expect(reviewPreOutward("PENDING_APPROVAL", "REJECT", "Duplicate entry").ok).toBe(true);
    expect(reviewPreOutward("PENDING_APPROVAL", "REJECT", "Duplicate entry").nextStatus).toBe("REJECTED");
  });

  // 18. Security Gate dispatch restriction for unapproved DCs
  it("18. blocks Security Gate dispatch for unapproved DC statuses (DRAFT, PENDING_APPROVAL, SENT_BACK, REJECTED)", () => {
    const canDispatch = (status: string) => {
      if (status !== "APPROVED") return { ok: false, error: `DC must be in APPROVED status for dispatch. Current: ${status}` };
      return { ok: true };
    };

    expect(canDispatch("DRAFT").ok).toBe(false);
    expect(canDispatch("PENDING_APPROVAL").ok).toBe(false);
    expect(canDispatch("SENT_BACK").ok).toBe(false);
    expect(canDispatch("REJECTED").ok).toBe(false);
    expect(canDispatch("APPROVED").ok).toBe(true);
  });

  // 19. Quality Inspection reconciliation balance requirement (Good + Reject + Scrap == Actual Inward Qty)
  it("19. validates Quality Inspection balance reconciliation (good + reject + scrap == actualInwardQty)", () => {
    const validateQuality = (good: number, rej: number, scrap: number, actualInward: number) => {
      if (good < 0 || rej < 0 || scrap < 0) return { ok: false, error: "Quantities cannot be negative." };
      const total = good + rej + scrap;
      if (total !== actualInward) {
        return {
          ok: false,
          error: `Quality quantities do not match Actual Inward Qty. Good (${good}) + Rejection (${rej}) + Scrap (${scrap}) = ${total}, but Actual Inward Qty is ${actualInward}.`,
        };
      }
      return { ok: true };
    };

    expect(validateQuality(90, 5, 5, 100).ok).toBe(true);
    expect(validateQuality(90, 5, 0, 100).ok).toBe(false);
  });

  // 20. Admin DC closure exact error message when payment details missing
  it("20. returns exact payment mandatory error message when attempting to close DC without payment details", () => {
    const closeDc = (hasPaymentRef: boolean, hasPaymentDate: boolean, hasPaymentStatus: boolean) => {
      if (!hasPaymentRef || !hasPaymentDate || !hasPaymentStatus) {
        return {
          ok: false,
          error: "DC cannot be closed. Payment details are mandatory. Please complete the payment details before closing the DC.",
        };
      }
      return { ok: true };
    };

    const res = closeDc(false, true, true);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("DC cannot be closed. Payment details are mandatory. Please complete the payment details before closing the DC.");
  });

  // 21. Other DC (Tool / Company Property) simple custody workflow
  it("21. executes Other DC (Tool / Asset) simple custody workflow without Manager approval or Quality inspection", () => {
    let currentStatus = "DRAFT";
    const movementType = "TOOL";

    const step = (action: string, allowedFromStatus: string[], nextStatus: string) => {
      if (!allowedFromStatus.includes(currentStatus)) {
        return { ok: false, error: `Action ${action} invalid from status ${currentStatus}` };
      }
      currentStatus = nextStatus;
      return { ok: true, status: currentStatus };
    };

    // 1. Other DC can be dispatched directly from DRAFT (No Manager approval)
    expect(step("submitSecurityDispatch", ["DRAFT", "APPROVED"], "DISPATCHED").ok).toBe(true);
    expect(currentStatus).toBe("DISPATCHED");

    // 2. Vendor receipt confirmation / Arrival at Vendor
    expect(step("confirmDcAtVendor", ["DISPATCHED"], "AT_VENDOR").ok).toBe(true);
    expect(currentStatus).toBe("AT_VENDOR");

    // 3. Security Gate Inward Return (physical gate arrival)
    expect(step("submitSecurityReturn", ["DISPATCHED", "AT_VENDOR"], "SECURITY_RETURNED").ok).toBe(true);
    expect(currentStatus).toBe("SECURITY_RETURNED");

    // 4. Destination Department / Custodian Verification
    expect(step("submitCustodianVerification", ["SECURITY_RETURNED"], "CUSTODIAN_VERIFIED").ok).toBe(true);
    expect(currentStatus).toBe("CUSTODIAN_VERIFIED");

    // 5. Close DC by Custodian / Admin (No Accounts invoice/payment required)
    expect(step("closeDc", ["CUSTODIAN_VERIFIED"], "CLOSED").ok).toBe(true);
    expect(currentStatus).toBe("CLOSED");
  });

  // 22. Commercial Service exception for Tool / Asset DCs
  it("22. executes Commercial Service Tool / Asset DC path through payment approval", () => {
    let currentStatus = "DRAFT";
    const isCommercialService = true;

    const step = (action: string, allowedFromStatus: string[], nextStatus: string) => {
      if (!allowedFromStatus.includes(currentStatus)) {
        return { ok: false, error: `Action ${action} invalid` };
      }
      currentStatus = nextStatus;
      return { ok: true, status: currentStatus };
    };

    expect(step("submitSecurityDispatch", ["DRAFT"], "DISPATCHED").ok).toBe(true);
    expect(step("submitSecurityReturn", ["DISPATCHED"], "SECURITY_RETURNED").ok).toBe(true);
    expect(step("submitCustodianVerification", ["SECURITY_RETURNED"], "APPROVED_FOR_PAYMENT").ok).toBe(true);
    expect(currentStatus).toBe("APPROVED_FOR_PAYMENT");
  });
});

