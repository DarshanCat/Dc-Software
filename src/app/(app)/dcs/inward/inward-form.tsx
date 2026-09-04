"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordInwardReceipt, RecordInwardReceiptInput } from "@/server/dcs/extended-actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

interface DcOption {
  id: string;
  dcNumber: string;
  vendorName: string;
  woNumber: string;
  partNumber: string;
  department: string;
  expectedQty: number;
  status: string;
}

interface Props {
  dcs: DcOption[];
}

export function InwardDcForm({ dcs }: Props) {
  const router = useRouter();

  const [selectedDcId, setSelectedDcId] = useState("");
  const [actualInwardQty, setActualInwardQty] = useState<string>("");
  const [inwardDate, setInwardDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [inwardDocumentNo, setInwardDocumentNo] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [inwardGatingWeight, setInwardGatingWeight] = useState("");
  const [inwardBoringWeight, setInwardBoringWeight] = useState("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedDc = dcs.find((d) => d.id === selectedDcId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedDcId) return setError("Please select a Delivery Challan.");
    const numQty = parseFloat(actualInwardQty);
    if (isNaN(numQty) || numQty <= 0) return setError("Actual Inward Quantity must be > 0.");

    setLoading(true);

    const payload: RecordInwardReceiptInput = {
      dcId: selectedDcId,
      actualInwardQty: numQty,
      inwardDate,
      inwardDocumentNo: inwardDocumentNo.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      inwardGatingWeight: inwardGatingWeight ? parseFloat(inwardGatingWeight) : undefined,
      inwardBoringWeight: inwardBoringWeight ? parseFloat(inwardBoringWeight) : undefined,
      remarks: remarks.trim() || undefined,
    };

    const res = await recordInwardReceipt(payload);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while recording inward receipt.");
    } else {
      setSuccess(`Inward receipt recorded for DC ${selectedDc?.dcNumber}.`);
      setTimeout(() => router.push(`/dcs/${selectedDcId}`), 1200);
    }
  }

  return (
    <div className="space-y-6">
      {/* DC SELECTOR */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Select DC for Physical Inward Receipt</label>
        <select
          value={selectedDcId}
          onChange={(e) => {
            setSelectedDcId(e.target.value);
            const dc = dcs.find((d) => d.id === e.target.value);
            if (dc) setActualInwardQty(String(dc.expectedQty));
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        >
          <option value="">-- Select Outward / Dispatched DC --</option>
          {dcs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.dcNumber} — {d.vendorName} (WO: {d.woNumber}, Expected Return: {d.expectedQty} NOS)
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
              <span className="text-slate-500 block">Expected Return Qty</span>
              <span className="font-bold text-blue-700 text-sm">{selectedDc.expectedQty} NOS</span>
            </div>
          </div>
        )}
      </div>

      {/* SECURITY INWARD FORM */}
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
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Security Control Policy: Quality decision fields (Good, Rejection, Scrap Qty) are managed exclusively by Quality Inspection.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Inward Qty (NOS) *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={actualInwardQty}
                onChange={(e) => setActualInwardQty(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Inward Date *</label>
              <input
                type="date"
                value={inwardDate}
                onChange={(e) => setInwardDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Inward Document No</label>
              <input
                type="text"
                value={inwardDocumentNo}
                onChange={(e) => setInwardDocumentNo(e.target.value)}
                placeholder="Gate Inward Pass No"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-12345"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Inward Gating Weight (KG)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={inwardGatingWeight}
                onChange={(e) => setInwardGatingWeight(e.target.value)}
                placeholder="0.000"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Inward Boring Weight (KG)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={inwardBoringWeight}
                onChange={(e) => setInwardBoringWeight(e.target.value)}
                placeholder="0.000"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Security Gate Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Gate observations or vehicle notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                  Recording Gate Receipt...
                </span>
              ) : (
                "Record Inward Receipt"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
