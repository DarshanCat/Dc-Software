"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMaterialReceipt } from "@/server/receipts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReceiveLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  sentQuantity: number;
  alreadyReceived: number;
}

interface LineDraft {
  quantityReceived: string;
  weightReceived: string;
  rejectedQuantity: string;
  rejectedWeight: string;
}

export function ReceiveMaterialForm({ dcId, lines }: { dcId: string; lines: ReceiveLine[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(
    Object.fromEntries(
      lines.map((l) => [l.itemId, { quantityReceived: "", weightReceived: "", rejectedQuantity: "", rejectedWeight: "" }]),
    ),
  );

  const setField = (itemId: string, field: keyof LineDraft, value: string) =>
    setDrafts((d) => ({ ...d, [itemId]: { ...d[itemId], [field]: value } }));

  async function submit() {
    setError(null);
    const submittedLines = lines
      .map((l) => {
        const d = drafts[l.itemId];
        const qty = Number(d.quantityReceived);
        const weight = Number(d.weightReceived);
        if (!qty || qty <= 0) return null;
        return {
          itemId: l.itemId,
          quantityReceived: qty,
          weightReceived: weight,
          rejectedQuantity: Number(d.rejectedQuantity) || 0,
          rejectedWeight: Number(d.rejectedWeight) || 0,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (submittedLines.length === 0) {
      setError("Enter a quantity received for at least one item.");
      return;
    }

    setBusy(true);
    const res = await createMaterialReceipt({ dcId, lines: submittedLines });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDrafts(
      Object.fromEntries(
        lines.map((l) => [l.itemId, { quantityReceived: "", weightReceived: "", rejectedQuantity: "", rejectedWeight: "" }]),
      ),
    );
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Receive Material</h2>
      <p className="-mt-2 mb-3 text-xs text-slate-500">
        Actual quantity may be more or less than the balance — variances are flagged at reconciliation.
      </p>
      <div className="space-y-4">
        {lines.map((l) => {
          const balance = l.sentQuantity - l.alreadyReceived;
          if (balance <= 0) return null;
          const d = drafts[l.itemId];
          return (
            <div key={l.itemId} className="rounded-md border border-slate-100 p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{l.itemCode} - {l.itemName}</span>
                <span className="text-slate-500">Balance: {balance} of {l.sentQuantity}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Qty Received</label>
                  <Input
                    type="number"
                    value={d.quantityReceived}
                    onChange={(e) => setField(l.itemId, "quantityReceived", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Weight Received (kg)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={d.weightReceived}
                    onChange={(e) => setField(l.itemId, "weightReceived", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Rejected Qty</label>
                  <Input
                    type="number"
                    value={d.rejectedQuantity}
                    onChange={(e) => setField(l.itemId, "rejectedQuantity", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Rejected Weight (kg)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={d.rejectedWeight}
                    onChange={(e) => setField(l.itemId, "rejectedWeight", e.target.value)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-3">
        <Button disabled={busy} onClick={submit}>
          {busy ? "Recording..." : "Record Receipt"}
        </Button>
      </div>
    </div>
  );
}