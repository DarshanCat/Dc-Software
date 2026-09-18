import { prisma } from "../lib/db";
import { DEFAULT_ROLE_PERMISSIONS } from "../config/permissions";

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Forbidden: missing permission ${permission}`);
    this.name = "ForbiddenError";
  }
}
export class UnauthenticatedError extends Error {
  constructor() {
    super("Unauthenticated");
    this.name = "UnauthenticatedError";
  }
}

export interface SessionUser {
  id: string;
  email: string;
  roleKeys: string[];
  vendorId: string | null;
  mustChangePassword?: boolean;
}

export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { users: { some: { userId } } } },
    select: { permission: { select: { key: true } } },
  });
  return new Set(rows.map((r: { permission: { key: string } }) => r.permission.key));
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { key: true } } },
  });
  const roleKeys = userRoles.map((ur) => ur.role.key);
  if (roleKeys.includes("ADMIN")) return true;

  // Check code-level default role permissions for assigned role keys
  for (const rKey of roleKeys) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[rKey as keyof typeof DEFAULT_ROLE_PERMISSIONS];
    if (defaults && defaults.includes(permission)) {
      return true;
    }
  }

  const perms = await getUserPermissions(userId);
  return perms.has(permission);
}

export async function requirePermission(
  user: SessionUser | null | undefined,
  permission: string,
): Promise<SessionUser> {
  if (!user) throw new UnauthenticatedError();
  if (user.mustChangePassword) throw new ForbiddenError("MUST_CHANGE_PASSWORD");

  if (user.roleKeys?.includes("ADMIN")) return user;

  if (user.roleKeys) {
    for (const rKey of user.roleKeys) {
      const defaults = DEFAULT_ROLE_PERMISSIONS[rKey as keyof typeof DEFAULT_ROLE_PERMISSIONS];
      if (defaults && defaults.includes(permission)) {
        return user;
      }
    }
  }

  const ok = await hasPermission(user.id, permission);
  if (!ok) throw new ForbiddenError(permission);
  return user;
}

export function assertVendorScope(user: SessionUser | null | undefined, dcVendorId?: string | null): void {
  if (!user) throw new UnauthenticatedError();
  if (user.roleKeys?.includes("ADMIN")) return;
  if (user.roleKeys?.includes("VENDOR")) {
    if (!user.vendorId) {
      throw new ForbiddenError("VENDOR_SCOPE_MISSING");
    }
    if (user.vendorId !== dcVendorId) {
      throw new ForbiddenError("VENDOR_SCOPE");
    }
  }
}