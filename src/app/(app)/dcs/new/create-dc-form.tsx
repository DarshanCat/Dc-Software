"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createDc, type CreateDcInput } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Opt = { id: string; name: string };

const PURPOSES = [
  "JOB_WORK", "MACHINING", "HEAT_TREATMENT", "SURFACE_TREATMENT",
  "REPAIR", "SAMPLE", "TRIAL", "SUBCONTRACTING", "OTHER",
];

export function CreateDcForm({ vendors, processes }: {
  vendors: Opt[]; processes: Opt[]; items?: Opt[]; standards?: unknown[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    woNumber: "",
    partNumber: "",
    rmQuantity: "",
    returnFgQuantity: "",
    heatNumber: "",
    vendorId: "",
    processId: "",
    purpose: "JOB_WORK",
    pricingBasis: "" as "RM" | "FG" | "",
    ratePerQuantity: "",
    preparedByName: "",
    expectedReturnDate: "",
    remarks: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const calculatedAmount = useMemo(() => {
    if (!form.pricingBasis || !form.ratePerQuantity || Number(form.ratePerQuantity) <= 0) return 0;
    const rate = Number(form.ratePerQuantity);
    const qty = form.pricingBasis === "RM" ? Number(form.rmQuantity) : Number(form.returnFgQuantity);
    if (!qty || qty <= 0) return 0;
    return Number((qty * rate).toFixed(2));
  }, [form.pricingBasis, form.ratePerQuantity, form.rmQuantity, form.returnFgQuantity]);

  async function submit() {
    if (!form.woNumber.trim()) {
      setError("WO ID is required.");
      return;
    }
    if (!form.partNumber.trim()) {
      setError("Part Number is required.");
      return;
    }
    if (!form.vendorId) {
      setError("Vendor is required.");
      return;
    }
    if (!form.processId) {
      setError("Process is required.");
      return;
    }
    if (!form.rmQuantity || Number(form.rmQuantity) <= 0) {
      setError("RM Qty must be greater than 0.");
      return;
    }
    if (!form.returnFgQuantity || Number(form.returnFgQuantity) <= 0) {
      setError("Return FG Qty must be greater than 0.");
      return;
    }
    if (!form.heatNumber.trim()) {
      setError("Heat Number is required.");
      return;
    }
    if (!form.pricingBasis) {
      setError("Please select a pricing basis: RM Quantity or FG Quantity.");
      return;
    }
    if (!form.ratePerQuantity || Number(form.ratePerQuantity) <= 0) {
      setError("Rate Per Quantity must be greater than zero.");
      return;
    }
    if (!form.preparedByName.trim()) {
      setError("Prepared By Name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      woNumber: form.woNumber.trim(),
      partNumber: form.partNumber.trim(),
      rmQuantity: Number(form.rmQuantity),
      returnFgQuantity: Number(form.returnFgQuantity),
      heatNumber: form.heatNumber.trim(),
      vendorId: form.vendorId,
      processId: form.processId,
      purpose: form.purpose,
      pricingBasis: form.pricingBasis as "RM" | "FG",
      ratePerQuantity: Number(form.ratePerQuantity),
      preparedByName: form.preparedByName.trim(),
      expectedReturnDate: form.expectedReturnDate,
      remarks: form.remarks,
    };

    const res = await createDc(payload as unknown as CreateDcInput);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/dcs/${res.dcId}`);
    router.refresh();
  }

  const Select = ({ k, label, opts, placeholder }: { k: string; label: string; opts: Opt[]; placeholder: string }) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
        value={(form as never)[k]}
        onChange={(e) => set(k, e.target.value)}
      >
        <option value="">{placeholder}</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* BASIC & MATERIAL SECTION */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Basic &amp; Material Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Work Order Number *</label>
            <Input
              value={form.woNumber}
              onChange={(e) => set("woNumber", e.target.value)}
              placeholder="e.g. WO-2026-00452"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Part Number *</label>
            <Input
              value={form.partNumber}
              onChange={(e) => set("partNumber", e.target.value)}
              placeholder="e.g. PART-VJS-4029"
            />
          </div>
          <Select k="vendorId" label="Vendor *" opts={vendors} placeholder="Select vendor" />
          <Select k="processId" label="Process *" opts={processes} placeholder="Select process" />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">RM Quantity (Sent) *</label>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={form.rmQuantity}
              onChange={(e) => set("rmQuantity", e.target.value)}
              placeholder="Raw material quantity sent to vendor"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Expected Return FG Quantity *</label>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={form.returnFgQuantity}
              onChange={(e) => set("returnFgQuantity", e.target.value)}
              placeholder="Finished goods quantity expected back"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Heat / Batch Number *</label>
            <Input
              value={form.heatNumber}
              onChange={(e) => set("heatNumber", e.target.value)}
              placeholder="e.g. HEAT-2026-X9"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Purpose *</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
            >
              {PURPOSES.map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* MANDATORY PRICING SECTION */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-5 space-y-4">
        <h2 className="text-sm font-bold text-blue-900 border-b border-blue-200/60 pb-2">
          Mandatory Pricing &amp; Commercial Terms
        </h2>
        
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Price Based On <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="pricingBasis"
                value="RM"
                checked={form.pricingBasis === "RM"}
                onChange={() => set("pricingBasis", "RM")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              RM Quantity (Sent)
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="pricingBasis"
                value="FG"
                checked={form.pricingBasis === "FG"}
                onChange={() => set("pricingBasis", "FG")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              FG Quantity (Returned)
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Choose whether vendor processing is charged per unit of Raw Material sent or Finished Goods returned.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Rate Per Quantity (₹) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={form.ratePerQuantity}
              onChange={(e) => set("ratePerQuantity", e.target.value)}
              placeholder="Enter rate (e.g. 1000.00)"
              className="bg-white"
            />
          </div>

          <div className="rounded-md border border-blue-200 bg-white p-3 flex flex-col justify-center">
            <span className="text-xs text-slate-500">Calculated Expected Total Amount</span>
            <span className="text-xl font-bold font-mono text-blue-900">
              ₹{calculatedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            {form.pricingBasis && Number(form.ratePerQuantity) > 0 && (
              <span className="text-[11px] text-slate-400">
                ({form.pricingBasis === "RM" ? `${form.rmQuantity || 0} RM` : `${form.returnFgQuantity || 0} FG`} × ₹{form.ratePerQuantity})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SIGNATURE & ADDITIONAL */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Document Details &amp; Additional Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Prepared By Name *</label>
            <Input
              value={form.preparedByName}
              onChange={(e) => set("preparedByName", e.target.value)}
              placeholder="Enter name to appear on DC"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Expected Return Date</label>
            <Input
              type="date"
              value={form.expectedReturnDate}
              onChange={(e) => set("expectedReturnDate", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Remarks / Special Instructions</label>
            <Input
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Additional notes for vendor or job work..."
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button onClick={submit} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white font-medium">
          {saving ? "Saving Draft..." : "Create DC (Saved as DRAFT)"}
        </Button>
      </div>
    </div>
  );
}