"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUserActive } from "@/server/users/actions";
import { Button } from "@/components/ui/button";

export function ToggleActiveButton({ userId, active, isSelf }: { userId: string; active: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    const res = await setUserActive(userId, !active);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  if (isSelf) {
    return <span className="text-xs text-slate-400">You</span>;
  }

  return (
    <div>
      <Button size="sm" variant={active ? "ghost" : "secondary"} disabled={busy} onClick={handleToggle}>
        {busy ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}