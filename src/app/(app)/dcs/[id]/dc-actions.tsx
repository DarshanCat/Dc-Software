"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitForApproval, approveDc, dispatchDc } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DcActions({ dcId, status, canApprove, canSubmit, canDispatch }: {
  dcId: string; status: string; canApprove: boolean; canSubmit: boolean; canDispatch: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporter, setTransporter] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Action failed."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {status === "DRAFT" && canSubmit && (
          <Button disabled={busy} onClick={() => run(() => submitForApproval(dcId))}>Submit for Approval</Button>
        )}
        {status === "PENDING_APPROVAL" && canApprove && (
          <Button disabled={busy} onClick={() => run(() => approveDc(dcId))}>Approve</Button>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {status === "APPROVED" && canDispatch && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Dispatch</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Vehicle Number</label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. KA-01-AB-1234" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Transporter</label>
              <Input value={transporter} onChange={(e) => setTransporter(e.target.value)} placeholder="e.g. BlueDart Logistics" />
            </div>
          </div>
          <div className="mt-3">
            <Button
              disabled={busy}
              onClick={() =>
                run(() =>
                  dispatchDc(dcId, {
                    vehicleNumber: vehicleNumber || undefined,
                    transporter: transporter || undefined,
                  }),
                )
              }
            >
              {busy ? "Dispatching…" : "Dispatch"}
            </Button>
          </div>
        </div>
      )}

      {status === "APPROVED" && !canDispatch && (
        <span className="text-sm text-slate-500">Approved — waiting on dispatch (requires DC_DISPATCH permission).</span>
      )}
    </div>
  );
}