"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClassification } from "@/server/classification/actions";
import { computeClassification } from "@/services/classification.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ClassifiableItem {
  itemId: string;
  itemCode: string;
  itemName: string;
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
  lines: Array<{ itemCode: string; receivedQty: number; goodQty: number; scrapQty: number; scrapTypeName: string | null }>;
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
  const [lines, setLines] = useState<Record<string, { good: string; scrap: string; scrapTypeId: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const outstanding = items.filter((it) => it.receivedQty - it.alreadyClassifiedQty > 0.0001);

  const setLine = (itemId: string, field: "good" | "scrap" | "scrapTypeId", value: string) => {
    setLines((prev) => {
      const current = prev[itemId] ?? { good: "", scrap: "", scrapTypeId: "" };
      return { ...prev, [itemId]: { ...current, [field]: value } };
    });
  };

  const previews = useMemo(() => {
    return outstanding.map((it) => {
      const line = lines[it.itemId];
      const remaining = it.receivedQty - it.alreadyClassifiedQty;
      const good = Number(line?.good || 0);
      const scrap = Number(line?.scrap || 0);
      const result = computeClassification({ receivedQty: remaining, goodQty: good, scrapQty: scrap });
      return { item: it, remaining, good, scrap, result };
    });
  }, [outstanding, lines]);

  async function submit() {
    setError(null);
    const toSubmit = previews.filter((p) => p.good > 0 || p.scrap > 0);
    if (toSubmit.length === 0) {
      setError("Enter at least one Good or Reject quantity.");
      return;
    }
    for (const p of toSubmit) {
      if (p.result.overClassified) {
        setError(`Good + Reject exceeds received quantity for ${p.item.itemCode}.`);
        return;
      }
      const line = lines[p.item.itemId];
      if (p.scrap > 0 && !line?.scrapTypeId) {
        setError(`Select a Reject Reason for ${p.item.itemCode}.`);
        return;
      }
    }

    setSaving(true);
    const res = await createClassification({
      dcId,
      lines: toSubmit.map((p) => ({
        itemId: p.item.itemId,
        receivedQty: p.remaining,
        goodQty: p.good,
        scrapQty: p.scrap,
        scrapTypeId: lines[p.item.itemId]?.scrapTypeId || undefined,
      })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLines({});
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
                  <span>{l.itemCode}</span>
                  <span>
                    Good {l.goodQty} · Reject {l.scrapQty}{l.scrapTypeName ? ` (${l.scrapTypeName})` : ""}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {outstanding.length === 0 ? (
        <p className="text-sm text-slate-400">No received material pending classification.</p>
      ) : (
        <div className="space-y-3">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Item</th>
                <th className="text-right">Pending Classification</th>
                <th className="text-right">Good</th>
                <th className="text-right">Reject</th>
                <th>Reject Reason</th>
                <th className="text-right">Unclassified</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((p) => (
                <tr key={p.item.itemId} className="border-t border-slate-100">
                  <td className="py-1.5">{p.item.itemCode} — {p.item.itemName}</td>
                  <td className="text-right font-mono">{p.remaining}</td>
                  <td className="text-right">
                    {canClassify ? (
                      <Input
                        className="h-8 w-20 text-right"
                        type="number"
                        value={lines[p.item.itemId]?.good ?? ""}
                        onChange={(e) => setLine(p.item.itemId, "good", e.target.value)}
                      />
                    ) : p.good}
                  </td>
                  <td className="text-right">
                    {canClassify ? (
                      <Input
                        className="h-8 w-20 text-right"
                        type="number"
                        value={lines[p.item.itemId]?.scrap ?? ""}
                        onChange={(e) => setLine(p.item.itemId, "scrap", e.target.value)}
                      />
                    ) : p.scrap}
                  </td>
                  <td>
                    {canClassify && (
                      <select
                        className="h-8 rounded-md border border-slate-300 bg-white px-1 text-xs"
                        value={lines[p.item.itemId]?.scrapTypeId ?? ""}
                        onChange={(e) => setLine(p.item.itemId, "scrapTypeId", e.target.value)}
                      >
                        <option value="">—</option>
                        {scrapTypes.map((st) => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td
                    className={`text-right font-mono ${
                      p.result.fullyClassified ? "text-green-700" : "text-amber-700"
                    }`}
                  >
                    {p.result.unclassifiedQty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canClassify && (
            <>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button size="sm" disabled={saving} onClick={submit}>
                {saving ? "Saving…" : "Save Classification"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}