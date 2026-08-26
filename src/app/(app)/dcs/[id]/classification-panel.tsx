"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClassification } from "@/server/classification/actions";
import { computeClassification } from "@/services/classification.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ClassifiableItem {
  receivedQty: number;
  alreadyClassifiedQty: number;
}

export interface ScrapTypeOpt {
  id: string;
  name: string;
}

export interface ClassificationRecord {
  id: string;
  classifiedAt: string;
  lines: Array<{ receivedQty: number; goodQty: number; scrapQty: number; scrapTypeName: string | null }>;
}

export function ClassificationPanel({
  dcId,
  items,
  scrapTypes,
  history,
  canClassify,
}: {
  dcId: string;
  items: ClassifiableItem[];
  scrapTypes: ScrapTypeOpt[];
  history: ClassificationRecord[];
  canClassify: boolean;
}) {
  const router = useRouter();
  const [goodQty, setGoodQty] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [scrapTypeId, setScrapTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalReceived = items.reduce((s, it) => s + it.receivedQty, 0);
  const totalClassified = items.reduce((s, it) => s + it.alreadyClassifiedQty, 0);
  const remaining = Math.max(totalReceived - totalClassified, 0);

  const good = Number(goodQty || 0);
  const scrap = Number(scrapQty || 0);
  const evalResult = useMemo(() => computeClassification({ receivedQty: remaining, goodQty: good, scrapQty: scrap }), [remaining, good, scrap]);

  async function submit() {
    setError(null);
    if (good <= 0 && scrap <= 0) {
      setError("Enter at least one Good or Reject quantity.");
      return;
    }
    if (evalResult.overClassified) {
      setError("Good + Reject exceeds received quantity.");
      return;
    }
    if (scrap > 0 && !scrapTypeId) {
      setError("Select a Reject Reason for rejected items.");
      return;
    }

    setSaving(true);
    const res = await createClassification({
      dcId,
      lines: [
        {
          itemId: "default",
          receivedQty: remaining,
          goodQty: good,
          scrapQty: scrap,
          scrapTypeId: scrapTypeId || undefined,
        },
      ],
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGoodQty("");
    setScrapQty("");
    setScrapTypeId("");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Internal Classification</h2>
      <p className="mb-3 text-xs text-slate-500">
        Material returned by the vendor is classified by our team as Good or Reject.
      </p>

      {history.length > 0 && (
        <div className="mb-4 space-y-2 border-b border-slate-100 pb-4">
          {history.map((h) => (
            <div key={h.id} className="text-xs text-slate-600">
              <div className="font-medium text-slate-500">{new Date(h.classifiedAt).toLocaleString()}</div>
              {h.lines.map((l, i) => (
                <div key={i} className="flex justify-between font-mono">
                  <span>Returned: {l.receivedQty}</span>
                  <span>Good: {l.goodQty} · Reject: {l.scrapQty} {l.scrapTypeName ? `(${l.scrapTypeName})` : ""}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {canClassify && remaining > 0 ? (
        <div className="space-y-3">
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1">Good Qty</label>
              <Input type="number" placeholder="Good" value={goodQty} onChange={(e) => setGoodQty(e.target.value)} />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Reject Qty</label>
              <Input type="number" placeholder="Reject" value={scrapQty} onChange={(e) => setScrapQty(e.target.value)} />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Reject Reason</label>
              <select
                className="w-full rounded border border-slate-300 bg-white p-2 text-xs"
                value={scrapTypeId}
                onChange={(e) => setScrapTypeId(e.target.value)}
              >
                <option value="">Select Reason</option>
                {scrapTypes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save Classification"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          {remaining <= 0 ? "All received material has been classified." : "You do not have permission to classify material."}
        </p>
      )}
    </div>
  );
}