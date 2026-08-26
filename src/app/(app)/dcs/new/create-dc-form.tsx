"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDc, type CreateDcInput } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Opt = { id: string; name: string };

const PURPOSES = ["JOB_WORK","MACHINING","HEAT_TREATMENT","SURFACE_TREATMENT","REPAIR","SAMPLE","TRIAL","SUBCONTRACTING","OTHER"];

export function CreateDcForm({ vendors, processes }: {
  vendors: Opt[]; processes: Opt[]; items?: Opt[]; standards?: unknown[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    woNumber: "", partNumber: "", rmQuantity: "", returnFgQuantity: "", heatNumber: "",
    vendorId: "", processId: "", purpose: "MACHINING",
    preparedByName: "", expectedReturnDate: "", remarks: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
        value={(form as never)[k]}
        onChange={(e) => set(k, e.target.value)}
      >
        <option value="">{placeholder}</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">WO ID *</label>
          <Input
            value={form.woNumber}
            onChange={(e) => set("woNumber", e.target.value)}
            placeholder="e.g. WO-2026-00452"
          />
          <p className="mt-1 text-xs text-slate-400">Work Order reference.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Part Number *</label>
          <Input
            value={form.partNumber}
            onChange={(e) => set("partNumber", e.target.value)}
            placeholder="Enter Part Number"
          />
          <p className="mt-1 text-xs text-slate-400">Manufactured Part Number (e.g. ABC-12345).</p>
        </div>
        <Select k="vendorId" label="Vendor *" opts={vendors} placeholder="Select vendor" />
        <Select k="processId" label="Process *" opts={processes} placeholder="Select process" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">RM Qty *</label>
          <Input
            type="number"
            step="0.001"
            min="0.001"
            value={form.rmQuantity}
            onChange={(e) => set("rmQuantity", e.target.value)}
            placeholder="Enter Raw Material Quantity"
          />
          <p className="mt-1 text-xs text-slate-400">Raw Material quantity sent for process.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Return FG Qty *</label>
          <Input
            type="number"
            step="0.001"
            min="0.001"
            value={form.returnFgQuantity}
            onChange={(e) => set("returnFgQuantity", e.target.value)}
            placeholder="Enter Expected Return FG Quantity"
          />
          <p className="mt-1 text-xs text-slate-400">Finished Goods quantity expected back.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Heat Number *</label>
          <Input
            value={form.heatNumber}
            onChange={(e) => set("heatNumber", e.target.value)}
            placeholder="Enter Heat Number"
          />
          <p className="mt-1 text-xs text-slate-400">Material Heat / Batch identifier.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Purpose *</label>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            value={form.purpose} onChange={(e) => set("purpose", e.target.value)}>
            {PURPOSES.map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Prepared By Name *</label>
          <Input
            value={form.preparedByName}
            onChange={(e) => set("preparedByName", e.target.value)}
            placeholder="Enter name to appear on DC"
          />
          <p className="mt-1 text-xs text-slate-400">Name to be printed on physical PDF.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Expected Return Date</label>
          <Input type="date" value={form.expectedReturnDate} onChange={(e) => set("expectedReturnDate", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Remarks</label>
          <Input value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Additional notes..." />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create DC (as Draft)"}</Button>
    </div>
  );
}