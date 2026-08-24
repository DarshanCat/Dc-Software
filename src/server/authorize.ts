import { prisma } from "../lib/db";

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
  const perms = await getUserPermissions(userId);
  return perms.has(permission);
}

export async function requirePermission(
  user: SessionUser | null | undefined,
  permission: string,
): Promise<SessionUser> {
  if (!user) throw new UnauthenticatedError();
  if (user.mustChangePassword) throw new ForbiddenError("MUST_CHANGE_PASSWORD");
  const ok = await hasPermission(user.id, permission);
  if (!ok) throw new ForbiddenError(permission);
  return user;
}

export function assertVendorScope(user: SessionUser, dcVendorId: string): void {
  if (user.roleKeys.includes("VENDOR") && user.vendorId !== dcVendorId) {
    throw new ForbiddenError("VENDOR_SCOPE");
  }
}