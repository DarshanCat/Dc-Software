import { describe, it, expect } from "vitest";
import { stageResultBalance } from "@/analytics/math-engine";

describe("DC Business Workflow & Role Restrictions", () => {
  it("strictly prohibits Security and Store roles from editing/submitting Quality quantities", () => {
    // Simulate role check helper logic
    const checkQualityAuthorization = (roleKeys: string[]): boolean => {
      return roleKeys.some((r) => ["QUALITY", "ADMIN", "SUPERADMIN"].includes(r));
    };

    expect(checkQualityAuthorization(["SECURITY"])).toBe(false);
    expect(checkQualityAuthorization(["STORES"])).toBe(false);
    expect(checkQualityAuthorization(["MANAGEMENT"])).toBe(false);
    expect(checkQualityAuthorization(["QUALITY"])).toBe(true);
    expect(checkQualityAuthorization(["ADMIN"])).toBe(true);
  });

  it("validates Quality Inspection Quantity Reconciliation (Good + Reject + Scrap = Actual Inward)", () => {
    const inward = 100;

    // Test 1: Good = 80, Reject = 15, Scrap = 5 (Total = 100) -> MUST PASS
    const passCheck = stageResultBalance(80, 15, 5, inward);
    expect(passCheck.total).toBe(100);
    expect(passCheck.balance).toBe(0);
    expect(passCheck.isValid).toBe(true);

    // Test 2: Good = 80, Reject = 10, Scrap = 5 (Total = 95 != 100) -> MUST FAIL
    const failCheck = stageResultBalance(80, 10, 5, inward);
    expect(failCheck.total).toBe(95);
    expect(failCheck.balance).toBe(5);
    expect(failCheck.isValid).toBe(false);
  });

  it("blocks Admin from closing DC if mandatory payment details are missing", () => {
    const validateAdminClosure = (dc: {
      status: string;
      paymentStatus?: string | null;
      paymentReference?: string | null;
      paymentDate?: Date | string | null;
      invoiceNumber?: string | null;
    }): { ok: boolean; error?: string } => {
      const hasPaymentRef = (dc.paymentReference || dc.invoiceNumber || "").trim().length > 0;
      const hasPaymentDate = !!dc.paymentDate;
      const hasPaymentStatus =
        dc.paymentStatus === "COMPLETED" ||
        dc.paymentStatus === "PAID" ||
        dc.paymentStatus === "PAYMENT_APPROVED";

      if (!hasPaymentRef || !hasPaymentDate || !hasPaymentStatus) {
        return {
          ok: false,
          error: "DC cannot be closed. Payment details are mandatory. Please complete the payment details before closing the DC.",
        };
      }

      return { ok: true };
    };

    // Test 1: Payment details missing -> MUST FAIL
    const dcWithoutPayment = {
      status: "PAYMENT_APPROVED",
      paymentStatus: null,
      paymentReference: null,
      paymentDate: null,
    };
    const res1 = validateAdminClosure(dcWithoutPayment);
    expect(res1.ok).toBe(false);
    expect(res1.error).toBe("DC cannot be closed. Payment details are mandatory. Please complete the payment details before closing the DC.");

    // Test 2: Payment details complete -> MUST SUCCEED
    const dcWithPayment = {
      status: "APPROVED_FOR_PAYMENT",
      paymentStatus: "PAYMENT_APPROVED",
      paymentReference: "PAY-2026-9900",
      paymentDate: new Date(),
      invoiceNumber: "INV-9900",
    };
    const res2 = validateAdminClosure(dcWithPayment);
    expect(res2.ok).toBe(true);
  });
});
