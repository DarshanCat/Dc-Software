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

    expect(labels).toEqual(["Security Operations"]);
    expect(labels).not.toContain("Accounts");
    expect(labels).not.toContain("Masters");
    expect(labels).not.toContain("Administration");

    const items = nav[0].items.map((i) => i.label);
    expect(items).toContain("Security Dashboard");
    expect(items).toContain("Waiting for Dispatch");
    expect(items).toContain("Dispatched / At Vendor");
    expect(items).toContain("Waiting for Return Entry");
    expect(items).toContain("My Security Entries");
  });

  it("STORES receives Store Operations navigation ONLY", () => {
    const nav = getNavigationForUser(["STORES"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toContain("Store Operations");
    expect(labels).toContain("Material Returns");
    expect(labels).not.toContain("Accounts");
    expect(labels).not.toContain("Administration");

    const storeItems = nav.find((s) => s.label === "Store Operations")!.items.map((i) => i.label);
    expect(storeItems).toContain("Store Dashboard");
    expect(storeItems).toContain("Create DC");
    expect(storeItems).toContain("My Drafts");
    expect(storeItems).toContain("Pending Approval");
    expect(storeItems).toContain("Store Verification Queue");
  });

  it("MANAGEMENT receives Management Portal navigation ONLY", () => {
    const nav = getNavigationForUser(["MANAGEMENT"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toContain("Management Portal");
    expect(labels).toContain("Reconciliation & Reports");
    expect(labels).not.toContain("Administration");

    const items = nav.find((s) => s.label === "Management Portal")!.items.map((i) => i.label);
    expect(items).toContain("Management Dashboard");
    expect(items).toContain("Pending Approvals");
    expect(items).toContain("Final Approval Queue");
    expect(items).toContain("Payment Approval Queue");
    expect(items).toContain("All DCs");
  });

  it("ACCOUNTS receives Accounts Financial Portal navigation ONLY", () => {
    const nav = getNavigationForUser(["ACCOUNTS"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toEqual(["Accounts Portal"]);
    expect(labels).not.toContain("Administration");
    expect(labels).not.toContain("Masters");

    const items = nav[0].items.map((i) => i.label);
    expect(items).toContain("Accounts Dashboard");
    expect(items).toContain("Approved for Payment");
    expect(items).toContain("Payment Entry & Close DC");
    expect(items).toContain("Closed DCs");
    expect(items).toContain("Payment History");
  });

  it("PRODUCTION receives Production Portal navigation ONLY", () => {
    const nav = getNavigationForUser(["PRODUCTION"]);
    const labels = nav.map((s) => s.label);

    expect(labels).toEqual(["Production Portal"]);
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
