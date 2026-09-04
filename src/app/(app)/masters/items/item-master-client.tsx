"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createItemMaster, updateItemMaster, toggleItemMasterStatus } from "@/server/masters/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, CheckCircle, XCircle } from "lucide-react";

interface ItemData {
  id: string;
  partNumber: string;
  partDescription: string;
  pricingBasis: "RW" | "FG";
  ratePerQuantity: number | null;
  uom: string;
  active: boolean;
  createdAt: string;
}

interface Props {
  items: ItemData[];
  canCreate: boolean;
  canEdit: boolean;
}

export function ItemMasterClient({ items, canCreate, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<"CREATE" | "EDIT" | null>(null);
  const [editItem, setEditItem] = useState<ItemData | null>(null);

  const [partNumber, setPartNumber] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [pricingBasis, setPricingBasis] = useState<"RW" | "FG">("RW");
  const [ratePerQuantity, setRatePerQuantity] = useState("");
  const [uom, setUom] = useState("NOS");

  function openCreate() {
    setPartNumber("");
    setPartDescription("");
    setPricingBasis("RW");
    setRatePerQuantity("");
    setUom("NOS");
    setError(null);
    setModal("CREATE");
  }

  function openEdit(item: ItemData) {
    setEditItem(item);
    setPartNumber(item.partNumber);
    setPartDescription(item.partDescription);
    setPricingBasis(item.pricingBasis);
    setRatePerQuantity(item.ratePerQuantity != null ? String(item.ratePerQuantity) : "");
    setUom(item.uom || "NOS");
    setError(null);
    setModal("EDIT");
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    const rateVal = ratePerQuantity ? parseFloat(ratePerQuantity) : undefined;

    let res;
    if (modal === "CREATE") {
      res = await createItemMaster({
        partNumber,
        partDescription,
        pricingBasis,
        ratePerQuantity: rateVal,
        uom,
      });
    } else if (modal === "EDIT" && editItem) {
      res = await updateItemMaster({
        id: editItem.id,
        partNumber,
        partDescription,
        pricingBasis,
        ratePerQuantity: rateVal,
        uom,
      });
    }

    setBusy(false);
    if (res && !res.ok) {
      setError(res.error || "Operation failed.");
    } else {
      setModal(null);
      router.refresh();
    }
  }

  async function handleToggle(id: string) {
    setBusy(true);
    await toggleItemMasterStatus(id);
    setBusy(false);
    router.refresh();
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
          placeholder="Search by Part Number or Description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-xs font-sans"
        />
        {canCreate && (
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add New Part / Item
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">Part Number</th>
              <th className="px-4 py-3">Part Description</th>
              <th className="px-4 py-3">Pricing Basis</th>
              <th className="px-4 py-3 text-right">Standard Rate (₹)</th>
              <th className="px-4 py-3">UOM</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                  No Part / Item master records found.
                </td>
              </tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{i.partNumber}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{i.partDescription}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                      {i.pricingBasis === "RW" ? "RW Quantity" : "Returning FG Quantity"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {i.ratePerQuantity != null ? `₹${Number(i.ratePerQuantity).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{i.uom}</td>
                  <td className="px-4 py-3">
                    {i.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <CheckCircle className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                        <XCircle className="h-3.5 w-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {canEdit && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openEdit(i)} className="text-[11px] h-7 px-2">
                          <Edit2 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleToggle(i.id)}
                          className={i.active ? "text-amber-700 h-7 text-[11px]" : "text-emerald-700 h-7 text-[11px]"}
                        >
                          {i.active ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {modal === "CREATE" ? "Add New Part / Item Master" : "Edit Part / Item Master"}
            </h3>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Part Number *</label>
                <Input
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="e.g. PN-1001"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Part Description *</label>
                <Input
                  value={partDescription}
                  onChange={(e) => setPartDescription(e.target.value)}
                  placeholder="e.g. Gear Housing Machined"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Pricing Basis *</label>
                <select
                  value={pricingBasis}
                  onChange={(e) => setPricingBasis(e.target.value as "RW" | "FG")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="RW">RW Quantity (Raw Material Outward Qty)</option>
                  <option value="FG">Returning FG Quantity</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Rate per Quantity (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratePerQuantity}
                  onChange={(e) => setRatePerQuantity(e.target.value)}
                  placeholder="e.g. 150.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measure (UOM)</label>
                <Input value={uom} onChange={(e) => setUom(e.target.value)} placeholder="e.g. NOS" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {modal === "CREATE" ? "Save Part Master" : "Update Part Master"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
