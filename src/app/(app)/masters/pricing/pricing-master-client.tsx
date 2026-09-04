"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateItemMaster } from "@/server/masters/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, DollarSign } from "lucide-react";

interface PricingItemData {
  id: string;
  partNumber: string;
  partDescription: string;
  pricingBasis: "RW" | "FG";
  ratePerQuantity: number | null;
  uom: string;
  active: boolean;
}

interface Props {
  items: PricingItemData[];
  canEdit: boolean;
}

export function PricingMasterClient({ items, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<PricingItemData | null>(null);
  const [pricingBasis, setPricingBasis] = useState<"RW" | "FG">("RW");
  const [ratePerQuantity, setRatePerQuantity] = useState("");

  function openEdit(item: PricingItemData) {
    setEditItem(item);
    setPricingBasis(item.pricingBasis);
    setRatePerQuantity(item.ratePerQuantity != null ? String(item.ratePerQuantity) : "");
    setError(null);
  }

  async function handleSave() {
    if (!editItem) return;
    setBusy(true);
    setError(null);

    const rateVal = ratePerQuantity ? parseFloat(ratePerQuantity) : undefined;
    const res = await updateItemMaster({
      id: editItem.id,
      partNumber: editItem.partNumber,
      partDescription: editItem.partDescription,
      pricingBasis,
      ratePerQuantity: rateVal,
      uom: editItem.uom,
    });

    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Failed to update pricing.");
    } else {
      setEditItem(null);
      router.refresh();
    }
  }

  const filtered = items.filter(
    (i) =>
      i.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.partDescription.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Input
          placeholder="Filter by Part Number or Description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-xs font-sans"
        />
        <div className="text-xs text-slate-500 font-medium">
          Authoritative Pricing Source: <span className="font-bold text-slate-800">Part Master Rates &amp; Basis</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">Part Number</th>
              <th className="px-4 py-3">Part Description</th>
              <th className="px-4 py-3">Price Based On</th>
              <th className="px-4 py-3 text-right">Standard Rate (₹)</th>
              <th className="px-4 py-3">UOM</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                  No pricing records configured in Part Master.
                </td>
              </tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{i.partNumber}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{i.partDescription}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
                      {i.pricingBasis === "RW" ? "RW QUANTITY" : "RETURNING FG QUANTITY"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800 text-sm">
                    {i.ratePerQuantity != null ? `₹${Number(i.ratePerQuantity).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{i.uom}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <Button variant="secondary" size="sm" onClick={() => openEdit(i)} className="text-[11px] h-7 px-2">
                        <Edit2 className="h-3 w-3 mr-1" /> Edit Rate &amp; Basis
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* EDIT PRICING MODAL */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Edit Pricing — {editItem.partNumber}
            </h3>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Part Description</label>
                <Input value={editItem.partDescription} readOnly disabled className="bg-slate-100 font-medium" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PRICE BASED ON *</label>
                <select
                  value={pricingBasis}
                  onChange={(e) => setPricingBasis(e.target.value as "RW" | "FG")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="RW">RW QUANTITY (Raw Material Outward Qty)</option>
                  <option value="FG">RETURNING FG QUANTITY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rate Per Quantity (₹) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratePerQuantity}
                  onChange={(e) => setRatePerQuantity(e.target.value)}
                  placeholder="Enter rate per quantity"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setEditItem(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                Save Pricing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
