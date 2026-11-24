"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateItemMaster } from "@/server/masters/items";
import { createJobWorkPricing, updateJobWorkPricing } from "@/server/masters/job-work-pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Plus, Sparkles, Building2, Wrench, Layers } from "lucide-react";

export interface JobWorkPricingData {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  processId: string;
  processName: string;
  processCode: string;
  partNumber: string;
  uom: string;
  rate: number;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

export interface PricingItemData {
  id: string;
  partNumber: string;
  partDescription: string;
  pricingBasis: "RW" | "FG";
  ratePerQuantity: number | null;
  uom: string;
  active: boolean;
}

interface VendorOption {
  id: string;
  vendorName: string;
  vendorCode: string;
}

interface ProcessOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  jobWorkPricings: JobWorkPricingData[];
  items: PricingItemData[];
  vendors: VendorOption[];
  processes: ProcessOption[];
  canEdit: boolean;
  canCreate: boolean;
}

export function PricingMasterClient({
  jobWorkPricings,
  items,
  vendors,
  processes,
  canEdit,
  canCreate,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"JOB_WORK" | "PART_MASTER">("JOB_WORK");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add Job Work Rate modal/form state
  const [showAddRate, setShowAddRate] = useState(false);
  const [addForm, setAddForm] = useState({
    vendorId: "",
    processId: "",
    partNumber: "",
    uom: "KG",
    rate: "",
    notes: "",
  });

  // Edit Job Work Rate state
  const [editRateItem, setEditRateItem] = useState<JobWorkPricingData | null>(null);
  const [editRateForm, setEditRateForm] = useState({
    rate: "",
    uom: "KG",
    active: true,
  });

  // Edit Part Master state
  const [editItem, setEditItem] = useState<PricingItemData | null>(null);
  const [pricingBasis, setPricingBasis] = useState<"RW" | "FG">("RW");
  const [ratePerQuantity, setRatePerQuantity] = useState("");

  // Filtered Job Work Rates
  const filteredJobWorkRates = jobWorkPricings.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.vendorName.toLowerCase().includes(q) ||
      p.processName.toLowerCase().includes(q) ||
      p.partNumber.toLowerCase().includes(q) ||
      p.uom.toLowerCase().includes(q)
    );
  });

  // Filtered Part Master
  const filteredItems = items.filter(
    (i) =>
      i.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.partDescription.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddRateSave() {
    setError(null);
    setSuccess(null);
    if (!addForm.vendorId) return setError("Please select a vendor.");
    if (!addForm.processId) return setError("Please select a job work standard.");
    if (!addForm.partNumber.trim()) return setError("Please enter part number (or ALL PARTS).");
    const rateVal = parseFloat(addForm.rate);
    if (isNaN(rateVal) || rateVal < 0) return setError("Please enter a valid rate (₹).");

    setBusy(true);
    const res = await createJobWorkPricing({
      vendorId: addForm.vendorId,
      processId: addForm.processId,
      partNumber: addForm.partNumber.trim(),
      uom: addForm.uom.trim().toUpperCase(),
      rate: rateVal,
      notes: addForm.notes.trim() || undefined,
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error || "Failed to create rate.");
    } else {
      setSuccess("Job work rate added successfully.");
      setShowAddRate(false);
      setAddForm({ vendorId: "", processId: "", partNumber: "", uom: "KG", rate: "", notes: "" });
      router.refresh();
    }
  }

  function openEditRate(item: JobWorkPricingData) {
    setEditRateItem(item);
    setEditRateForm({
      rate: String(item.rate),
      uom: item.uom,
      active: item.active,
    });
    setError(null);
  }

  async function handleSaveRateEdit() {
    if (!editRateItem) return;
    setError(null);
    setSuccess(null);
    const rateVal = parseFloat(editRateForm.rate);
    if (isNaN(rateVal) || rateVal < 0) return setError("Please enter a valid rate (₹).");

    setBusy(true);
    const res = await updateJobWorkPricing({
      id: editRateItem.id,
      vendorId: editRateItem.vendorId,
      processId: editRateItem.processId,
      partNumber: editRateItem.partNumber,
      uom: editRateForm.uom,
      rate: rateVal,
      active: editRateForm.active,
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error || "Failed to update rate.");
    } else {
      setSuccess("Job work rate updated successfully.");
      setEditRateItem(null);
      router.refresh();
    }
  }

  function openEditItem(item: PricingItemData) {
    setEditItem(item);
    setPricingBasis(item.pricingBasis);
    setRatePerQuantity(item.ratePerQuantity != null ? String(item.ratePerQuantity) : "");
    setError(null);
  }

  async function handleSaveItemEdit() {
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
      setSuccess("Part rate updated successfully.");
      setEditItem(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => { setActiveTab("JOB_WORK"); setSearch(""); }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "JOB_WORK"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Job Work Rates ({jobWorkPricings.length})
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("PART_MASTER"); setSearch(""); }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "PART_MASTER"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Layers className="h-4 w-4" />
          Part Master Standard Rates ({items.length})
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200 font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200 font-medium">
          {success}
        </div>
      )}

      {/* ================= TAB 1: JOB WORK RATES ================= */}
      {activeTab === "JOB_WORK" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Input
              placeholder="Search vendor, standard, part, UOM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs text-xs font-sans"
            />
            {canCreate && !showAddRate && !editRateItem && (
              <Button onClick={() => setShowAddRate(true)} className="flex items-center gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Job Work Rate
              </Button>
            )}
          </div>

          {/* Add Job Work Rate Form */}
          {showAddRate && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
              <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" />
                Add New Job Work Pricing Rule
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Vendor *</label>
                  <select
                    value={addForm.vendorId}
                    onChange={(e) => setAddForm({ ...addForm, vendorId: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="">-- Select Vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.vendorName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Job Work Standard *</label>
                  <select
                    value={addForm.processId}
                    onChange={(e) => setAddForm({ ...addForm, processId: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="">-- Select Standard / Process --</option>
                    {processes.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Part ID / Number *</label>
                  <Input
                    placeholder="e.g. ADN2, WIE3 or ALL PARTS"
                    value={addForm.partNumber}
                    onChange={(e) => setAddForm({ ...addForm, partNumber: e.target.value })}
                    className="text-xs font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">UOM *</label>
                  <select
                    value={addForm.uom}
                    onChange={(e) => setAddForm({ ...addForm, uom: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="KG">KG (Kilograms)</option>
                    <option value="NO">NO / NOS (Pieces)</option>
                    <option value="KGS">KGS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Rate (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 55.00"
                    value={addForm.rate}
                    onChange={(e) => setAddForm({ ...addForm, rate: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Notes</label>
                  <Input
                    placeholder="Optional notes or remarks"
                    value={addForm.notes}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={handleAddRateSave} disabled={busy} className="text-xs">
                  {busy ? "Saving..." : "Save Rate"}
                </Button>
                <Button variant="secondary" onClick={() => setShowAddRate(false)} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Edit Job Work Rate Inline Modal / Card */}
          {editRateItem && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 space-y-3">
              <h2 className="text-sm font-bold text-amber-950">
                Edit Rate: {editRateItem.vendorName} — {editRateItem.processName} ({editRateItem.partNumber})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Rate (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editRateForm.rate}
                    onChange={(e) => setEditRateForm({ ...editRateForm, rate: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">UOM</label>
                  <select
                    value={editRateForm.uom}
                    onChange={(e) => setEditRateForm({ ...editRateForm, uom: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="KG">KG</option>
                    <option value="NO">NO / NOS</option>
                    <option value="KGS">KGS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Status</label>
                  <select
                    value={editRateForm.active ? "true" : "false"}
                    onChange={(e) => setEditRateForm({ ...editRateForm, active: e.target.value === "true" })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={handleSaveRateEdit} disabled={busy} className="text-xs">
                  {busy ? "Saving..." : "Update Rate"}
                </Button>
                <Button variant="secondary" onClick={() => setEditRateItem(null)} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Vendor / Supplier</th>
                  <th className="px-4 py-3">Job Work Standard</th>
                  <th className="px-4 py-3">Part ID</th>
                  <th className="px-4 py-3">UOM</th>
                  <th className="px-4 py-3 text-right">Rate (₹)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobWorkRates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No job work rates found matching &quot;{search}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredJobWorkRates.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{r.vendorName}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.processName}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-800 font-bold">{r.partNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-600 uppercase">{r.uom}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                        ₹{r.rate.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canEdit && (
                          <Button
                            variant="secondary"
                            onClick={() => openEditRate(r)}
                            className="h-7 px-2.5 text-[11px]"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: PART MASTER STANDARD RATES ================= */}
      {activeTab === "PART_MASTER" && (
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

          {/* Edit Part Master Item */}
          {editItem && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 space-y-3">
              <h2 className="text-sm font-bold text-amber-950">
                Edit Part Rate: {editItem.partNumber} — {editItem.partDescription}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Pricing Basis</label>
                  <select
                    value={pricingBasis}
                    onChange={(e) => setPricingBasis(e.target.value as "RW" | "FG")}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="RW">RW Quantity (Raw Material Outward)</option>
                    <option value="FG">FG Quantity (Returning Finished Goods)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Standard Rate (₹)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ratePerQuantity}
                    onChange={(e) => setRatePerQuantity(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={handleSaveItemEdit} disabled={busy} className="text-xs">
                  {busy ? "Saving..." : "Save Part Rate"}
                </Button>
                <Button variant="secondary" onClick={() => setEditItem(null)} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}

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
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No parts found matching &quot;{search}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{item.partNumber}</td>
                      <td className="px-4 py-2.5 text-slate-700">{item.partDescription}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-slate-800">
                          {item.pricingBasis === "RW" ? "RM Quantity" : "Returning FG Quantity"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                        {item.ratePerQuantity != null ? `₹${item.ratePerQuantity.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500 uppercase">{item.uom}</td>
                      <td className="px-4 py-2.5 text-right">
                        {canEdit && (
                          <Button
                            variant="secondary"
                            onClick={() => openEditItem(item)}
                            className="h-7 px-2.5 text-[11px]"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
