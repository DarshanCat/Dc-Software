"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRecoveryReceipt } from "@/server/recovery/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface RecoveryTypeOpt {
  id: string;
  code: string;
  name: string;
}

export interface RecoveryReceiptRow {
  id: string;
  recoveryTypeName: string;
  weight: number;
  receiptDate: string;
  remarks: string | null;
}

export interface RecoveryRollupRow {
  recoveryTypeId: string;
  name: string;
  sentWeight: string;
  receivedWeight: string;
  pendingWeight: string;
  recoveryPercent: string | null;
}

/**
 * Boring / recovery panel for a single DC (spec §11–§12): shows the
 * sent/received/pending/recovery% rollup and lets you record a new receipt.
 * Multiple receipts are supported — each submission adds a new lot, history
 * is preserved (nothing is overwritten).
 */
export function RecoveryPanel({
  dcId,
  recoveryTypes,
  rollup,
  receipts,
  canReceive,
}: {
  dcId: string;
  recoveryTypes: RecoveryTypeOpt[];
  rollup: RecoveryRollupRow[];
  receipts: RecoveryReceiptRow[];
  canReceive: boolean;
}) {
  const router = useRouter();
  const [recoveryTypeId, setRecoveryTypeId] = useState("");
  const [weight, setWeight] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await createRecoveryReceipt({
      dcId,
      recoveryTypeId,
      weight: Number(weight),
      remarks: remarks || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRecoveryTypeId("");
    setWeight("");
    setRemarks("");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Boring / Recovery Material</h2>

      {rollup.length === 0 ? (
        <p className="text-sm text-slate-400">No recovery requirement declared for this DC.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Type</th>
              <th className="text-right">Sent</th>
              <th className="text-right">Received</th>
              <th className="text-right">Pending</th>
              <th className="text-right">Recovery %</th>
            </tr>
          </thead>
          <tbody>
            {rollup.map((r) => (
              <tr key={r.recoveryTypeId} className="border-t border-slate-100">
                <td className="py-1.5">{r.name}</td>
                <td className="text-right font-mono">{r.sentWeight} kg</td>
                <td className="text-right font-mono">{r.receivedWeight} kg</td>
                <td className="text-right font-mono">{r.pendingWeight} kg</td>
                <td className="text-right font-mono">
                  {r.recoveryPercent === null ? "N/A" : `${r.recoveryPercent}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {receipts.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          <div className="text-xs font-medium text-slate-500">Receipt history</div>
          {receipts.map((r) => (
            <div key={r.id} className="flex justify-between font-mono text-xs text-slate-600">
              <span>{r.recoveryTypeName} — {new Date(r.receiptDate).toLocaleDateString()}</span>
              <span>{r.weight.toFixed(3)} kg{r.remarks ? ` (${r.remarks})` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {canReceive && recoveryTypes.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          <div className="text-xs font-medium text-slate-700">Record a recovery receipt</div>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={recoveryTypeId}
              onChange={(e) => setRecoveryTypeId(e.target.value)}
            >
              <option value="">Select type</option>
              {recoveryTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
            <Input
              type="number"
              step="any"
              placeholder="Weight (kg)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <Input
              placeholder="Remarks (optional)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            size="sm"
            disabled={saving || !recoveryTypeId || !weight}
            onClick={submit}
          >
            {saving ? "Saving…" : "Record Receipt"}
          </Button>
        </div>
      )}
    </div>
  );
}