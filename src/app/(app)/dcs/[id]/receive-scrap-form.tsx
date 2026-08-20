"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createScrapReceipt } from "@/server/scrap/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ScrapTypeOpt {
  id: string;
  code: string;
  name: string;
}

interface DraftLine {
  scrapTypeId: string;
  weight: string;
}

export function ReceiveScrapForm({ dcId, scrapTypes }: { dcId: string; scrapTypes: ScrapTypeOpt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weighmentSlipNumber, setWeighmentSlipNumber] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ scrapTypeId: scrapTypes[0]?.id ?? "", weight: "" }]);

  const addLine = () => setLines((l) => [...l, { scrapTypeId: scrapTypes[0]?.id ?? "", weight: "" }]);
  const removeLine = (idx: number) => setLines((l) => l.filter((_, i) => i !== idx));
  const setLine = (idx: number, field: keyof DraftLine, value: string) =>
    setLines((l) => l.map((line, i) => (i === idx ? { ...line, [field]: value } : line)));

  async function submit() {
    setError(null);
    const submittedLines = lines
      .filter((l) => Number(l.weight) > 0 && l.scrapTypeId)
      .map((l) => ({ scrapTypeId: l.scrapTypeId, weight: Number(l.weight), uom: "KG" }));

    if (submittedLines.length === 0) {
      setError("Enter a weight for at least one scrap line.");
      return;
    }

    setBusy(true);
    const res = await createScrapReceipt({
      dcId,
      weighmentSlipNumber: weighmentSlipNumber || undefined,
      lines: submittedLines,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLines([{ scrapTypeId: scrapTypes[0]?.id ?? "", weight: "" }]);
    setWeighmentSlipNumber("");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Receive Scrap</h2>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">Weighment Slip Number</label>
        <Input value={weighmentSlipNumber} onChange={(e) => setWeighmentSlipNumber(e.target.value)} placeholder="e.g. WS-55521" />
      </div>

      <div className="space-y-2">
        {lines.map((line, idx) => (
          <div key={idx} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Scrap Type</label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                value={line.scrapTypeId}
                onChange={(e) => setLine(idx, "scrapTypeId", e.target.value)}
              >
                {scrapTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="mb-1 block text-xs font-medium text-slate-600">Weight (kg)</label>
              <Input
                type="number"
                step="0.001"
                value={line.weight}
                onChange={(e) => setLine(idx, "weight", e.target.value)}
              />
            </div>
            {lines.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeLine(idx)}>
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2">
        <Button variant="secondary" size="sm" onClick={addLine}>
          + Add Scrap Line
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-3">
        <Button disabled={busy} onClick={submit}>
          {busy ? "Recording…" : "Record Scrap Receipt"}
        </Button>
      </div>
    </div>
  );
}