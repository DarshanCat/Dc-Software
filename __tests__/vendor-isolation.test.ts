import { describe, it, expect } from "vitest";
import { getVendorScope, assertVendorScope } from "../src/server/dcs/vendor-scope";
import { ForbiddenError, UnauthenticatedError, SessionUser } from "../src/server/authorize";

describe("Vendor Data Isolation Security Suite", () => {
  const adminUser: SessionUser = {
    id: "u-admin",
    email: "admin@factory.com",
    roleKeys: ["ADMIN"],
    vendorId: null,
  };

  const storeUser: SessionUser = {
    id: "u-store",
    email: "store@factory.com",
    roleKeys: ["STORES"],
    vendorId: null,
  };

  const vendor1User: SessionUser = {
    id: "u-v1",
    email: "vendor1@supplier.com",
    roleKeys: ["VENDOR"],
    vendorId: "vendor-uuid-1",
  };

  const vendor2User: SessionUser = {
    id: "u-v2",
    email: "vendor2@supplier.com",
    roleKeys: ["VENDOR"],
    vendorId: "vendor-uuid-2",
  };

  const vendorNoIdUser: SessionUser = {
    id: "u-vnoid",
    email: "unassigned@supplier.com",
    roleKeys: ["VENDOR"],
    vendorId: null,
  };

  describe("getVendorScope()", () => {
    it("returns empty scope for internal ADMIN role", () => {
      const scope = getVendorScope(adminUser);
      expect(scope).toEqual({});
    });

    it("returns empty scope for internal STORES role", () => {
      const scope = getVendorScope(storeUser);
      expect(scope).toEqual({});
    });

    it("returns exact vendorId scope for VENDOR role with valid vendorId", () => {
      const scope = getVendorScope(vendor1User);
      expect(scope).toEqual({ vendorId: "vendor-uuid-1" });
    });

    it("fails closed with __NO_VENDOR_ASSIGNED__ for VENDOR role lacking vendorId", () => {
      const scope = getVendorScope(vendorNoIdUser);
      expect(scope).toEqual({ vendorId: "__NO_VENDOR_ASSIGNED__" });
    });

    it("fails closed with __NO_USER_SESSION__ for null or undefined session", () => {
      expect(getVendorScope(null)).toEqual({ vendorId: "__NO_USER_SESSION__" });
      expect(getVendorScope(undefined)).toEqual({ vendorId: "__NO_USER_SESSION__" });
    });
  });

  describe("assertVendorScope()", () => {
    it("allows ADMIN to access any vendor ID", () => {
      expect(() => assertVendorScope(adminUser, "vendor-uuid-1")).not.toThrow();
      expect(() => assertVendorScope(adminUser, "vendor-uuid-2")).not.toThrow();
      expect(() => assertVendorScope(adminUser, null)).not.toThrow();
    });

    it("allows VENDOR user to access their matching vendor ID", () => {
      expect(() => assertVendorScope(vendor1User, "vendor-uuid-1")).not.toThrow();
      expect(() => assertVendorScope(vendor2User, "vendor-uuid-2")).not.toThrow();
    });

    it("blocks VENDOR user from accessing another vendor's resource (IDOR protection)", () => {
      expect(() => assertVendorScope(vendor1User, "vendor-uuid-2")).toThrow(ForbiddenError);
      expect(() => assertVendorScope(vendor2User, "vendor-uuid-1")).toThrow(ForbiddenError);
    });

    it("blocks VENDOR user with missing vendorId from accessing any vendor resource", () => {
      expect(() => assertVendorScope(vendorNoIdUser, "vendor-uuid-1")).toThrow(ForbiddenError);
    });

    it("throws UnauthenticatedError when session is missing", () => {
      expect(() => assertVendorScope(null, "vendor-uuid-1")).toThrow(UnauthenticatedError);
    });
  });
});
