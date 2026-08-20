"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GlobalSearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push("/search?q=" + encodeURIComponent(q.trim()));
  }

  return (
    <form onSubmit={handleSubmit} className="w-72">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search DC, vendor, item, batch..."
        className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm placeholder:text-slate-400"
      />
    </form>
  );
}