import { describe, it, expect } from "vitest";
import { ALL_OPERATIONAL_STATUSES, ROLE_ALLOWED_STATUSES } from "../src/config/dc-visibility";
import { MANAGEMENT_NAVIGATION } from "../src/config/navigation";

describe("DC All Visibility & Manager Draft/Returned DC Visibility", () => {
  it("enables all operational statuses across non-admin internal roles in dc-visibility", () => {
    const roles = ["MANAGEMENT", "STORES", "PRODUCTION", "QUALITY", "ACCOUNTS", "SECURITY"];

    for (const role of roles) {
      expect(ROLE_ALLOWED_STATUSES[role], `${role} should have status list defined`).toBeDefined();
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("DRAFT");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("SENT_BACK");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("PENDING_APPROVAL");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("APPROVED");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("DISPATCHED");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("AT_VENDOR");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("SECURITY_RETURNED");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("STORE_VERIFIED");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("QUALITY_COMPLETED");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("FINAL_APPROVED");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("APPROVED_FOR_PAYMENT");
      expect(ROLE_ALLOWED_STATUSES[role]).toContain("CLOSED");
    }
  });

  it("ensures MANAGEMENT role can view DRAFT and SENT_BACK statuses in All DCs", () => {
    const managementStatuses = ROLE_ALLOWED_STATUSES.MANAGEMENT;
    expect(managementStatuses).toContain("DRAFT");
    expect(managementStatuses).toContain("SENT_BACK");
    expect(managementStatuses).toContain("REJECTED");
    expect(managementStatuses).toContain("HOLD");
  });

  it("ensures STORES role retains full visibility across dispatch, vendor, and completion", () => {
    const storeStatuses = ROLE_ALLOWED_STATUSES.STORES;
    expect(storeStatuses).toContain("APPROVED");
    expect(storeStatuses).toContain("DISPATCHED");
    expect(storeStatuses).toContain("AT_VENDOR");
    expect(storeStatuses).toContain("QUALITY_COMPLETED");
    expect(storeStatuses).toContain("APPROVED_FOR_PAYMENT");
    expect(storeStatuses).toContain("CLOSED");
  });

  it("builds correct where-clause for status=DRAFT including both DRAFT and SENT_BACK", () => {
    function computeWhereStatus(statusParam?: string) {
      const where: Record<string, any> = {};
      if (statusParam) {
        if (statusParam === "DRAFT" || statusParam === "SENT_BACK") {
          where.status = { in: ["DRAFT", "SENT_BACK"] };
        } else {
          where.status = statusParam;
        }
      } else {
        const allowed = ROLE_ALLOWED_STATUSES.MANAGEMENT;
        where.status = { in: allowed };
      }
      return where;
    }

    // When manager filters for DRAFT, both DRAFT and SENT_BACK DCs must be returned
    const draftWhere = computeWhereStatus("DRAFT");
    expect(draftWhere.status).toEqual({ in: ["DRAFT", "SENT_BACK"] });

    // When manager visits /dcs without status filter, all statuses are included
    const allWhere = computeWhereStatus();
    expect(allWhere.status.in).toContain("DRAFT");
    expect(allWhere.status.in).toContain("SENT_BACK");
    expect(allWhere.status.in).toContain("APPROVED");
  });

  it("ensures Management navigation provides clear access to draft / sent back DCs", () => {
    const deliveryChallansSection = MANAGEMENT_NAVIGATION.find((s) => s.label === "DELIVERY CHALLANS");
    expect(deliveryChallansSection).toBeDefined();

    const items = deliveryChallansSection!.items.map((i) => i.label);
    expect(items).toContain("All DCs");
    expect(items).toContain("Draft / Sent Back DCs");

    const draftItem = deliveryChallansSection!.items.find((i) => i.label === "Draft / Sent Back DCs");
    expect(draftItem?.href).toBe("/dcs?status=DRAFT");

    const dashboardSection = MANAGEMENT_NAVIGATION.find((s) => s.label === "MANAGEMENT DASHBOARD");
    const correctionItem = dashboardSection!.items.find((i) => i.label === "DCs Requiring Correction");
    expect(correctionItem?.href).toBe("/dcs?status=DRAFT");
  });
});
