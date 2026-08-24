"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function GlobalSearchBox() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");

  useEffect(() => {
    setQ(searchParams.get("q") || "");
  }, [searchParams]);

  let placeholder = "";
  let targetUrl = "";
  let isVisible = false;

  if (
    pathname === "/dcs" ||
    pathname === "/dashboard/open" ||
    pathname === "/dashboard/overdue" ||
    pathname === "/dashboard/material-outside" ||
    pathname === "/dashboard/scrap-outstanding" ||
    pathname === "/dashboard/exceptions" ||
    pathname === "/search"
  ) {
    isVisible = true;
    placeholder = "Search DC number or WO ID...";
    targetUrl = "/search";
  } else if (pathname === "/masters/vendors") {
    isVisible = true;
    placeholder = "Search vendor name or code...";
    targetUrl = "/masters/vendors";
  } else if (pathname === "/masters/items") {
    isVisible = true;
    placeholder = "Search item code or name...";
    targetUrl = "/masters/items";
  } else if (pathname === "/admin/users") {
    isVisible = true;
    placeholder = "Search name, email or ID...";
    targetUrl = "/admin/users";
  }

  if (!isVisible) {
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) {
      router.push(targetUrl);
      return;
    }
    router.push(`${targetUrl}?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-72">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
    </form>
  );
}