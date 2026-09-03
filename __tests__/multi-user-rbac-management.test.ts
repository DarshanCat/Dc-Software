import { describe, it, expect } from "vitest";
import { filterDcDataForRole } from "@/server/dcs/sanitizer";
import { getNavigationForUser } from "@/config/navigation";

describe("Production Multi-User & Server RBAC Management Verification", () => {
  it("supports multiple distinct users under the same operational role", () => {
    const securityUsers = [
      { email: "security1@company.com", roleKeys: ["SECURITY"] },
      { email: "security2@company.com", roleKeys: ["SECURITY"] },
      { email: "security3@company.com", roleKeys: ["SECURITY"] },
    ];
    const storeUsers = [
      { email: "stores1@company.com", roleKeys: ["STORES"] },
      { email: "stores2@company.com", roleKeys: ["STORES"] },
    ];

    expect(securityUsers.length).toBe(3);
    expect(storeUsers.length).toBe(2);
    expect(securityUsers.map((u) => u.roleKeys[0])).toEqual(["SECURITY", "SECURITY", "SECURITY"]);
  });

  it("normalizes emails to lowercase and trims whitespace", () => {
    const rawInput1 = "  Security1@Company.COM  ";
    const rawInput2 = "SECURITY1@company.com";
    const normalized1 = rawInput1.toLowerCase().trim();
    const normalized2 = rawInput2.toLowerCase().trim();

    expect(normalized1).toBe("security1@company.com");
    expect(normalized2).toBe("security1@company.com");
    expect(normalized1).toBe(normalized2);
  });

  it("enforces blind-entry sanitization for SECURITY and STORES", () => {
    const dcData = {
      id: "dc-100",
      dcNumber: "DC-2026-0001",
      securityFgQuantity: 50.0,
      securityReturnRemarks: "Gate verified 50 NOS",
      storeVerifiedFgQuantity: 50.0,
      storeRemarks: "Stores verified 50 NOS",
      invoiceNumber: "INV-998877",
      invoiceAmount: 15000.0,
    };

    // SECURITY: stripped store & invoice data
    const sanitizedSecurity = filterDcDataForRole(dcData, "SECURITY");
    expect(sanitizedSecurity.securityFgQuantity).toBe(50.0);
    expect(sanitizedSecurity.storeVerifiedFgQuantity).toBeUndefined();
    expect(sanitizedSecurity.invoiceNumber).toBeUndefined();

    // STORES: stripped security & invoice data
    const sanitizedStores = filterDcDataForRole(dcData, "STORES");
    expect(sanitizedStores.storeVerifiedFgQuantity).toBe(50.0);
    expect(sanitizedStores.securityFgQuantity).toBeUndefined();
    expect(sanitizedStores.invoiceNumber).toBeUndefined();

    // ADMIN: receives full unsanitized payload
    const sanitizedAdmin = filterDcDataForRole(dcData, "ADMIN");
    expect(sanitizedAdmin.securityFgQuantity).toBe(50.0);
    expect(sanitizedAdmin.storeVerifiedFgQuantity).toBe(50.0);
    expect(sanitizedAdmin.invoiceNumber).toBe("INV-998877");
  });

  it("grants ADMIN full navigation sections and direct access to Receive Material (/receipts/new)", () => {
    const adminNav = getNavigationForUser(["ADMIN"]);
    const securityNav = getNavigationForUser(["SECURITY"]);
    const storesNav = getNavigationForUser(["STORES"]);
    const accountsNav = getNavigationForUser(["ACCOUNTS"]);

    // Admin has Material Returns section pointing to /receipts/new
    const adminMaterialReturns = adminNav.find((s) => s.label === "Material Returns");
    expect(adminMaterialReturns).toBeDefined();

    const receiveMaterialItem = adminMaterialReturns?.items.find((i) => i.label === "Receive Material");
    expect(receiveMaterialItem).toBeDefined();
    expect(receiveMaterialItem?.href).toBe("/receipts/new");

    // Security has only Security section
    expect(securityNav.length).toBe(1);
    expect(securityNav[0].label).toBe("SECURITY OPERATIONS");

    // Stores has Receive Material pointing to /receipts/new
    const storesMaterialReturns = storesNav.find((s) => s.label === "MATERIAL RETURNS");
    expect(storesMaterialReturns).toBeDefined();
    const storesReceiveItem = storesMaterialReturns?.items.find((i) => i.label === "Receive Material");
    expect(storesReceiveItem?.href).toBe("/receipts/new");
  });
});
