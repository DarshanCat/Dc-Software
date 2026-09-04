import { SessionUser, ForbiddenError, UnauthenticatedError } from "../authorize";

export interface VendorWhereClause {
  vendorId?: string;
}

/**
 * Returns a Prisma `where` filter fragment for vendor scoping.
 * - If user has VENDOR role and vendorId: `{ vendorId: user.vendorId }`
 * - If user has VENDOR role but NO vendorId: `{ vendorId: "__NO_VENDOR_ASSIGNED__" }` (fails closed)
 * - If user is not VENDOR: `{}`
 */
export function getVendorScope(user: SessionUser | null | undefined): VendorWhereClause {
  if (!user) {
    return { vendorId: "__NO_USER_SESSION__" };
  }

  if (user.roleKeys?.includes("VENDOR")) {
    if (!user.vendorId) {
      // Fail closed if VENDOR user has no vendorId assigned
      return { vendorId: "__NO_VENDOR_ASSIGNED__" };
    }
    return { vendorId: user.vendorId };
  }

  return {};
}

/**
 * Asserts that a user has access to a specific vendor's resource.
 * - If user is ADMIN: passes.
 * - If user is VENDOR: throws ForbiddenError if user.vendorId is missing or does not match dcVendorId.
 */
export function assertVendorScope(user: SessionUser | null | undefined, dcVendorId?: string | null): void {
  if (!user) {
    throw new UnauthenticatedError();
  }

  if (user.roleKeys?.includes("ADMIN")) {
    return;
  }

  if (user.roleKeys?.includes("VENDOR")) {
    if (!user.vendorId) {
      throw new ForbiddenError("VENDOR_SCOPE_MISSING");
    }
    if (user.vendorId !== dcVendorId) {
      throw new ForbiddenError("VENDOR_SCOPE");
    }
  }
}
