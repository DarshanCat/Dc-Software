"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmStoreReceipt, ConfirmStoreReceiptInput } from "@/server/dcs/extended-actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Warehouse } from "lucide-react";

interface DcOption {
  id: string;
  dcNumber: string;
  vendorName: string;
  woNumber: string;
  partNumber: string;
  department: string;
  actualInwardQty: number;
  status: string;
}

interface Props {
  dcs: DcOption[];
}

export function StoreReceiptForm({ dcs }: Props) {
  const router = useRouter();

  const [selectedDcId, setSelectedDcId] = useState("");
  const [storeReceivedQty, setStoreReceivedQty] = useState<string>("");
  const [storeReceivedDate, setStoreReceivedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedDc = dcs.find((d) => d.id === selectedDcId);
  const actualInward = selectedDc ? selectedDc.actualInwardQty : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedDcId) return setError("Please select a Delivery Challan.");
    const numQty = parseFloat(storeReceivedQty);
    if (isNaN(numQty) || numQty <= 0) return setError("Store Received Quantity must be > 0.");
    if (numQty > actualInward && actualInward > 0) {
      return setError(`Store Received Qty (${numQty}) cannot exceed Actual Inward Qty (${actualInward}).`);
    }

    setLoading(true);

    const payload: ConfirmStoreReceiptInput = {
      dcId: selectedDcId,
      storeReceivedQty: numQty,
      storeReceivedDate,
      storeRemarks: remarks.trim() || undefined,
    };

    const res = await confirmStoreReceipt(payload);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while confirming store receipt.");
    } else {
      setSuccess(`Store receipt confirmed for DC ${selectedDc?.dcNumber}. Moved to QUALITY_PENDING.`);
      setTimeout(() => router.push(`/dcs/${selectedDcId}`), 1200);
    }
  }

  return (
    <div className="space-y-6">
      {/* DC SELECTOR */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Select Inward DC for Store Confirmation</label>
        <select
          value={selectedDcId}
          onChange={(e) => {
            setSelectedDcId(e.target.value);
            const dc = dcs.find((d) => d.id === e.target.value);
            if (dc) setStoreReceivedQty(String(dc.actualInwardQty));
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        >
          <option value="">-- Select Inward Received DC --</option>
          {dcs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.dcNumber} — {d.vendorName} (WO: {d.woNumber}, Inward Qty: {d.actualInwardQty} NOS)
            </option>
          ))}
        </select>

        {selectedDc && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md bg-slate-50 p-4 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Supplier</span>
              <span className="font-semibold text-slate-900">{selectedDc.vendorName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Work Order / Part</span>
              <span className="font-semibold text-slate-900">{selectedDc.woNumber} / {selectedDc.partNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Department</span>
              <span className="font-semibold text-slate-900">{selectedDc.department}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Actual Inward Qty</span>
              <span className="font-bold text-blue-700 text-sm">{selectedDc.actualInwardQty} NOS</span>
            </div>
          </div>
        )}
      </div>

      {/* STORE CONFIRMATION FORM */}
      {selectedDc && (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 p-2.5 rounded-md">
            <Warehouse className="h-4 w-4 text-blue-600" />
            <span>Store Control Policy: Store confirms physical quantity into inventory. Quality inspection will be performed separately by Quality.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store Received Qty (NOS) *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                max={actualInward}
                value={storeReceivedQty}
                onChange={(e) => setStoreReceivedQty(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-[11px] text-slate-500 block mt-1">Max allowed: {actualInward} NOS</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store Receipt Date *</label>
              <input
                type="date"
                value={storeReceivedDate}
                onChange={(e) => setStoreReceivedDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Rack/Bin location or store notes"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirming Store Receipt...
                </span>
              ) : (
                "CONFIRM STORE RECEIPT"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
