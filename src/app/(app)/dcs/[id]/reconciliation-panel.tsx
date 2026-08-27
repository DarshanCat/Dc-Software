"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeReconciliationDc, approveException, recalculateReconciliation } from "@/server/reconciliation/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExceptionRow {
  id: string;
  type: string;
  description: string;
  variance: number | null;
  status: string;
}

interface ReconciliationData {
  status: string;
  totalInputWeight: number;
  totalFinishedWeight: number;
  totalScrapWeight: number;
  approvedProcessLoss: number;
  accountedWeight: number;
  unaccountedWeight: number;
}

export function ReconciliationPanel({
  dcId,
  reconciliation,
  exceptions,
  canClose,
  canOverride,
}: {
  dcId: string;
  reconciliation: ReconciliationData;
  exceptions: ExceptionRow[];
  canClose: boolean;
  canOverride: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [closeReason, setCloseReason] = useState("");

  const openExceptions = exceptions.filter((e) => ["OPEN", "UNDER_REVIEW", "REJECTED"].includes(e.status));
  const canCloseNow = canClose && openExceptions.length === 0;

  async function handleApprove(exceptionId: string) {
    const reason = reasons[exceptionId];
    if (!reason || reason.trim().length === 0) {
      setError("Enter a reason before approving this exception.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await approveException(exceptionId, reason);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleClose() {
    setError(null);
    setBusy(true);
    const res = await closeReconciliationDc(dcId, closeReason || undefined);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleRecalculate() {
    setError(null);
    setBusy(true);
    const res = await recalculateReconciliation(dcId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Reconciliation</h2>

      <div className="grid grid-cols-2 gap-1 font-mono text-sm text-slate-700">
        <span>Material Sent</span><span className="text-right">{reconciliation.totalInputWeight.toFixed(3)} kg</span>
        <span>Finished Received</span><span className="text-right">{reconciliation.totalFinishedWeight.toFixed(3)} kg</span>
        <span>Scrap Recovered</span><span className="text-right">{reconciliation.totalScrapWeight.toFixed(3)} kg</span>
        <span>Approved Process Loss</span><span className="text-right">{reconciliation.approvedProcessLoss.toFixed(3)} kg</span>
        <span className="border-t border-slate-200 pt-1">Accounted</span>
        <span className="border-t border-slate-200 pt-1 text-right">{reconciliation.accountedWeight.toFixed(3)} kg</span>
        <span className="font-semibold">Unaccounted</span>
        <span className="text-right font-semibold">{reconciliation.unaccountedWeight.toFixed(3)} kg</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span
          className={
            reconciliation.status === "BALANCED"
              ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
              : reconciliation.status === "CLOSED"
                ? "rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
                : "rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
          }
        >
          {reconciliation.status}
        </span>
        {canOverride && reconciliation.status !== "CLOSED" && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={handleRecalculate}>
            Recalculate
          </Button>
        )}
      </div>

      {exceptions.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          <h3 className="text-xs font-semibold uppercase text-slate-500">Exceptions</h3>
          {exceptions.map((e) => {
            const isOpen = ["OPEN", "UNDER_REVIEW", "REJECTED"].includes(e.status);
            return (
              <div key={e.id} className="rounded-md border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{e.type.replace(/_/g, " ")}</span>
                  <span
                    className={
                      isOpen
                        ? "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
                        : "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                    }
                  >
                    {e.status}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">{e.description}</p>
                {isOpen && canOverride && (
                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-600">Approval Reason *</label>
                      <Input
                        value={reasons[e.id] ?? ""}
                        onChange={(ev) => setReasons((r) => ({ ...r, [e.id]: ev.target.value }))}
                        placeholder="Why is this exception acceptable to override?"
                      />
                    </div>
                    <Button size="sm" disabled={busy} onClick={() => handleApprove(e.id)}>
                      Approve Exception
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {canClose && reconciliation.status !== "CLOSED" && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          {!canCloseNow && openExceptions.length > 0 && (
            <p className="mb-2 text-sm text-slate-500">
              Approve all {openExceptions.length} open exception(s) above before this DC can be closed.
            </p>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Closure Note (optional)</label>
              <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
            </div>
            <Button disabled={busy || !canCloseNow} onClick={handleClose}>
              {busy ? "Closing…" : "Close DC"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}