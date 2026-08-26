"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createDc, type CreateDcInput } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Opt = { id: string; name: string };
type Std = { itemId: string; processId: string; scrapPct: number; lossPct: number };

const PURPOSES = ["JOB_WORK","MACHINING","HEAT_TREATMENT","SURFACE_TREATMENT","REPAIR","SAMPLE","TRIAL","SUBCONTRACTING","OTHER"];

export function CreateDcForm({ vendors, processes, items, standards }: {
  vendors: Opt[]; processes: Opt[]; items: Opt[]; standards: Std[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    woNumber: "", partNumber: "", expectedScrap: "", vendorId: "", processId: "", itemId: "", purpose: "MACHINING",
    quantity: "", inputWeight: "", preparedByName: "", expectedReturnDate: "", remarks: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const preview = useMemo(() => {
    const input = Number(form.inputWeight);
    if (!input || input <= 0) return null;
    const std = standards.find((s) => s.itemId === form.itemId && s.processId === form.processId);
    const scrapPct = std?.scrapPct ?? 0;
    const lossPct = std?.lossPct ?? 0;
    const scrap = (input * scrapPct) / 100;
    const loss = (input * lossPct) / 100;
    const finished = input - scrap - loss;
    return {
      hasStd: !!std,
      finished: finished.toFixed(3),
      scrap: scrap.toFixed(3),
      loss: loss.toFixed(3),
      accounted: (finished + scrap + loss).toFixed(3),
      input: input.toFixed(3),
    };
  }, [form.inputWeight, form.itemId, form.processId, standards]);

  async function submit() {
    if (!form.partNumber.trim()) {
      setError("Part Number is required.");
      return;
    }
    if (form.expectedScrap !== "" && Number(form.expectedScrap) < 0) {
      setError("Expected Scrap cannot be negative.");
      return;
    }
    if (!form.preparedByName.trim()) {
      setError("Prepared By Name is required.");
      return;
    }
    setSaving(true); setError(null);
    const payload = {
      woNumber: form.woNumber,
      partNumber: form.partNumber.trim(),
      expectedScrap: form.expectedScrap !== "" ? Number(form.expectedScrap) : 0,
      vendorId: form.vendorId,
      processId: form.processId,
      purpose: form.purpose,
      preparedByName: form.preparedByName.trim(),
      expectedReturnDate: form.expectedReturnDate,
      remarks: form.remarks,
      items: [
        {
          itemId: form.itemId,
          quantity: form.quantity,
          inputWeight: form.inputWeight,
        },
      ],
    };
    const res = await createDc(payload as unknown as CreateDcInput);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
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
        <Select k="itemId" label="Item *" opts={items} placeholder="Select item" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Purpose *</label>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            value={form.purpose} onChange={(e) => set("purpose", e.target.value)}>
            {PURPOSES.map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Quantity *</label>
          <Input type="number" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Input Weight (kg) *</label>
          <Input type="number" value={form.inputWeight} onChange={(e) => set("inputWeight", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Expected Scrap (kg)</label>
          <Input
            type="number"
            step="0.001"
            min="0"
            value={form.expectedScrap}
            onChange={(e) => set("expectedScrap", e.target.value)}
            placeholder="Enter expected scrap quantity"
          />
          <p className="mt-1 text-xs text-slate-400">Scrap expected to be recovered from vendor for this movement.</p>
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Remarks</label>
          <Input value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
        </div>
      </div>

      {preview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="mb-2 font-semibold text-slate-900">Reconciliation Preview</div>
          {!preview.hasStd && (
            <p className="mb-2 text-xs text-amber-700">
              No approved Job Work Standard for this item + process — expected scrap/loss default to 0.
            </p>
          )}
          <div className="grid grid-cols-2 gap-1 font-mono text-slate-700">
            <span>Material Sent</span><span className="text-right">{preview.input} kg</span>
            <span>Expected Finished</span><span className="text-right">{preview.finished} kg</span>
            <span>Expected Scrap</span><span className="text-right">{preview.scrap} kg</span>
            <span>Allowed Process Loss</span><span className="text-right">{preview.loss} kg</span>
            <span className="border-t border-slate-300 pt-1 font-semibold">Expected Accounted</span>
            <span className="border-t border-slate-300 pt-1 text-right font-semibold">{preview.accounted} kg</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create DC (as Draft)"}</Button>
    </div>
  );
}