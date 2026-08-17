"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "…";
  // @ts-expect-error custom field on session
  const roles: string[] = session?.user?.roleKeys ?? [];

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center px-4 justify-between">
      <div className="text-sm text-slate-500">
        Delivery Challan &amp; Vendor Material Management
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm text-slate-700">{email}</div>
          {roles.length > 0 && (
            <div className="text-xs text-slate-400">{roles.join(", ")}</div>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </Button>
      </div>
    </header>
  );
}