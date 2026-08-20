"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitForApproval, approveDc } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";

export function DcActions({ dcId, status, canApprove, canSubmit }: {
  dcId: string; status: string; canApprove: boolean; canSubmit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Action failed."); return; }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && canSubmit && (
        <Button disabled={busy} onClick={() => run(() => submitForApproval(dcId))}>Submit for Approval</Button>
      )}
      {status === "PENDING_APPROVAL" && canApprove && (
        <Button disabled={busy} onClick={() => run(() => approveDc(dcId))}>Approve</Button>
      )}
      {status === "APPROVED" && (
        <span className="text-sm text-slate-500">Approved — dispatch comes next (sub-slice 3).</span>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}