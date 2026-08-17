"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-900">DC & Vendor</div>
        <div className="text-xs text-slate-500">Material Management</div>
      </div>
      <nav className="p-2">
        {NAVIGATION.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href.split("?")[0];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block rounded-md px-2 py-1.5 text-sm",
                        active
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-200",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}