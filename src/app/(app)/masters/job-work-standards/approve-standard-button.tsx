"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveJobWorkStandard } from "@/server/job-work-standards/actions";
import { Button } from "@/components/ui/button";

export function ApproveStandardButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    const res = await approveJobWorkStandard(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <Button size="sm" disabled={busy} onClick={handleApprove}>
        {busy ? "Approving…" : "Approve"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}