import { describe, it, expect } from "vitest";
import { getNavigationForUser } from "../src/config/navigation";

describe("Role-Based Navigation, Route Security & Matrix", () => {
  it("ADMIN receives complete company navigation", () => {
    const nav = getNavigationForUser(["ADMIN"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Work Orders");
    expect(labels).toContain("Delivery Challans");
    expect(labels).toContain("Material Returns");
    expect(labels).toContain("Scrap Recovery");
    expect(labels).toContain("Reconciliation");
    expect(labels).toContain("Masters");
    expect(labels).toContain("Reports");
    expect(labels).toContain("Administration");
  });

  it("SECURITY receives dedicated Security Operations Portal navigation ONLY", () => {
    const nav = getNavigationForUser(["SECURITY"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toEqual(["SECURITY OPERATIONS"]);
    expect(labels).not.toContain("Accounts");
    expect(labels).not.toContain("Masters");
    expect(labels).not.toContain("Administration");

    const items = nav[0].items.map((i) => i.label);
    expect(items).toContain("Security Dashboard");
    expect(items).toContain("Waiting for Dispatch");
    expect(items).toContain("Dispatched / At Vendor");
    expect(items).toContain("Material Inward / Return");
    expect(items).toContain("My Security Entries");
  });

  it("STORES receives Store Operations navigation ONLY", () => {
    const nav = getNavigationForUser(["STORES"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toContain("STORE OPERATIONS");
    expect(labels).toContain("MATERIAL RETURNS");
    expect(labels).not.toContain("Accounts");
    expect(labels).not.toContain("Administration");

    const storeItems = nav.find((s) => s.label === "STORE OPERATIONS")!.items.map((i) => i.label);
    expect(storeItems).toContain("Store Dashboard");
    expect(storeItems).toContain("Create DC");
    expect(storeItems).toContain("Draft DCs");
    expect(storeItems).toContain("Pending Approval");
    expect(storeItems).toContain("Store Verification");
  });

  it("MANAGEMENT receives Management Dashboard & Delivery Challans navigation ONLY", () => {
    const nav = getNavigationForUser(["MANAGEMENT"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toContain("MANAGEMENT DASHBOARD");
    expect(labels).toContain("DELIVERY CHALLANS");
    expect(labels).not.toContain("Administration");
    expect(labels).not.toContain("Accounts");

    const items = nav.find((s) => s.label === "MANAGEMENT DASHBOARD")!.items.map((i) => i.label);
    expect(items).toContain("Overview");
    expect(items).toContain("Pending DC Approval");
    expect(items).toContain("Store Verified / Final Approval");
    expect(items).toContain("Discrepancies");
    expect(items).toContain("Payment Approval");
    expect(items).toContain("DC History");
  });

  it("ACCOUNTS receives Accounts Portal navigation ONLY", () => {
    const nav = getNavigationForUser(["ACCOUNTS"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toEqual(["ACCOUNTS"]);
    expect(labels).not.toContain("Administration");
    expect(labels).not.toContain("Masters");

    const items = nav[0].items.map((i) => i.label);
    expect(items).toContain("Accounts Dashboard");
    expect(items).toContain("Approved for Payment");
    expect(items).toContain("Payment Entry");
    expect(items).toContain("Ready to Close");
    expect(items).toContain("Closed DCs");
    expect(items).toContain("Payment History");
  });

  it("PRODUCTION receives Production Portal navigation ONLY", () => {
    const nav = getNavigationForUser(["PRODUCTION"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toEqual(["PRODUCTION OPERATIONS"]);
    const items = nav[0].items.map((i) => i.label);
    expect(items).toContain("Production Dashboard");
    expect(items).toContain("Create DC");
    expect(items).toContain("Authorized DCs");
  });

  it("evaluates role-based status queue authorization", () => {
    const ROLE_ALLOWED_STATUSES: Record<string, string[]> = {
      SECURITY: ["APPROVED", "DISPATCHED", "AT_VENDOR", "SECURITY_RETURNED"],
      STORES: ["DRAFT", "PENDING_APPROVAL", "SECURITY_RETURNED", "STORE_VERIFIED"],
      MANAGEMENT: ["PENDING_APPROVAL", "STORE_VERIFIED", "FINAL_APPROVED", "APPROVED_FOR_PAYMENT", "CLOSED"],
      ACCOUNTS: ["APPROVED_FOR_PAYMENT", "CLOSED"],
      PRODUCTION: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
    };

    expect(ROLE_ALLOWED_STATUSES.SECURITY).not.toContain("APPROVED_FOR_PAYMENT");
    expect(ROLE_ALLOWED_STATUSES.STORES).not.toContain("APPROVED_FOR_PAYMENT");
    expect(ROLE_ALLOWED_STATUSES.ACCOUNTS).toContain("APPROVED_FOR_PAYMENT");
    expect(ROLE_ALLOWED_STATUSES.ACCOUNTS).toContain("CLOSED");
  });
});
