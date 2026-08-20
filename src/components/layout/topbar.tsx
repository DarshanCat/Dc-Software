"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { GlobalSearchBox } from "@/components/layout/global-search-box";

export function Topbar() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "...";
  // @ts-expect-error custom field on session
  const roles: string[] = session?.user?.roleKeys ?? [];

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center px-4 justify-between gap-4">
      <div className="hidden shrink-0 text-sm text-slate-500 md:block">
        Delivery Challan &amp; Vendor Material Management
      </div>
      <GlobalSearchBox />
      <div className="flex items-center gap-3">
        <NotificationBell />
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