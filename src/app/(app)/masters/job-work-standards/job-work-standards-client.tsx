"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJobWorkStandard, updateJobWorkStandard, toggleJobWorkStandardStatus } from "@/server/masters/job-work-standards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, CheckCircle, XCircle } from "lucide-react";

interface ProcessOption {
  id: string;
  code: string;
  name: string;
}

interface StandardData {
  id: string;
  processId: string;
  processName: string;
  partNumber: string;
  standardLossPercentage: number;
  turnaroundDays: number;
  ratePerQuantity: number | null;
  active: boolean;
  createdAt: string;
}

interface Props {
  standards: StandardData[];
  processes: ProcessOption[];
  canCreate: boolean;
}

export function JobWorkStandardsClient({ standards, processes, canCreate }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<"CREATE" | "EDIT" | null>(null);
  const [editStd, setEditStd] = useState<StandardData | null>(null);

  const [processId, setProcessId] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [standardLossPercentage, setStandardLossPercentage] = useState("0");
  const [turnaroundDays, setTurnaroundDays] = useState("15");
  const [ratePerQuantity, setRatePerQuantity] = useState("");

  function openCreate() {
    setProcessId(processes[0]?.id || "");
    setPartNumber("");
    setStandardLossPercentage("0");
    setTurnaroundDays("15");
    setRatePerQuantity("");
    setError(null);
    setModal("CREATE");
  }

  function openEdit(std: StandardData) {
    setEditStd(std);
    setProcessId(std.processId);
    setPartNumber(std.partNumber);
    setStandardLossPercentage(String(std.standardLossPercentage));
    setTurnaroundDays(String(std.turnaroundDays));
    setRatePerQuantity(std.ratePerQuantity != null ? String(std.ratePerQuantity) : "");
    setError(null);
    setModal("EDIT");
  }

  async function handleSave() {
    setBusy(true);
    setError(null);

    const lossVal = parseFloat(standardLossPercentage) || 0;
    const daysVal = parseInt(turnaroundDays, 10) || 15;
    const rateVal = ratePerQuantity ? parseFloat(ratePerQuantity) : undefined;

    let res;
    if (modal === "CREATE") {
      res = await createJobWorkStandard({
        processId,
        partNumber,
        standardLossPercentage: lossVal,
        turnaroundDays: daysVal,
        ratePerQuantity: rateVal,
      });
    } else if (modal === "EDIT" && editStd) {
      res = await updateJobWorkStandard({
        id: editStd.id,
        processId,
        partNumber,
        standardLossPercentage: lossVal,
        turnaroundDays: daysVal,
        ratePerQuantity: rateVal,
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
    await toggleJobWorkStandardStatus(id);
    setBusy(false);
    router.refresh();
  }

  const filtered = standards.filter(
    (s) =>
      s.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.processName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Input
          placeholder="Search Part Number or Process..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-xs font-sans"
        />
        {canCreate && (
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Job Work Standard
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">Process</th>
              <th className="px-4 py-3">Part Number</th>
              <th className="px-4 py-3 text-right">Standard Loss (%)</th>
              <th className="px-4 py-3 text-right">Expected Days</th>
              <th className="px-4 py-3 text-right">Rate (₹)</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                  No Job Work Standards configured.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{s.processName}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">{s.partNumber}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {Number(s.standardLossPercentage).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{s.turnaroundDays} Days</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                    {s.ratePerQuantity != null ? `₹${Number(s.ratePerQuantity).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.active ? (
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
                    {canCreate && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openEdit(s)} className="text-[11px] h-7 px-2">
                          <Edit2 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleToggle(s.id)}
                          className={s.active ? "text-amber-700 h-7 text-[11px]" : "text-emerald-700 h-7 text-[11px]"}
                        >
                          {s.active ? "Deactivate" : "Activate"}
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
              {modal === "CREATE" ? "Add Job Work Standard" : "Edit Job Work Standard"}
            </h3>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Process *</label>
                <select
                  value={processId}
                  onChange={(e) => setProcessId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Part Number *</label>
                <Input
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="e.g. PN-1001"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Process Loss (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={standardLossPercentage}
                  onChange={(e) => setStandardLossPercentage(e.target.value)}
                  placeholder="e.g. 2.0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Turnaround Days</label>
                <Input
                  type="number"
                  value={turnaroundDays}
                  onChange={(e) => setTurnaroundDays(e.target.value)}
                  placeholder="e.g. 15"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Process Rate (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratePerQuantity}
                  onChange={(e) => setRatePerQuantity(e.target.value)}
                  placeholder="Optional process rate"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {modal === "CREATE" ? "Save Standard" : "Update Standard"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
