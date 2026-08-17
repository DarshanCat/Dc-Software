import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "./authorize";
import { redirect } from "next/navigation";

/** Redirect to /login if not signed in; otherwise return the SessionUser. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Returns the current SessionUser (id, email, roleKeys, vendorId) or null.
 * Server-side only. Use in server components, route handlers, server actions.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as
    | { id?: string; email?: string; roleKeys?: string[]; vendorId?: string | null }
    | undefined;
  if (!u?.id || !u.email) return null;
  return {
    id: u.id,
    email: u.email,
    roleKeys: u.roleKeys ?? [],
    vendorId: u.vendorId ?? null,
  };
}