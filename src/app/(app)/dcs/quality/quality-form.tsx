"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitQualityInspection, SubmitQualityInspectionInput } from "@/server/dcs/extended-actions";
import { stageResultBalance } from "@/analytics/math-engine";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Check, XCircle } from "lucide-react";

interface DcOption {
  id: string;
  dcNumber: string;
  vendorName: string;
  woNumber: string;
  partNumber: string;
  department: string;
  actualInwardQty: number;
  storeReceivedQty: number;
  status: string;
}

interface Props {
  dcs: DcOption[];
}

export function QualityInspectionForm({ dcs }: Props) {
  const router = useRouter();

  const [selectedDcId, setSelectedDcId] = useState("");
  const [goodQty, setGoodQty] = useState<string>("0");
  const [rejectionQty, setRejectionQty] = useState<string>("0");
  const [scrapQty, setScrapQty] = useState<string>("0");
  const [qualityDecision, setQualityDecision] = useState<"PASSED" | "PARTIAL_ACCEPTANCE" | "REJECTED" | "SCRAPPED">("PASSED");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedDc = dcs.find((d) => d.id === selectedDcId);
  const actualInward = selectedDc ? selectedDc.actualInwardQty : 0;

  const numGood = parseFloat(goodQty) || 0;
  const numReject = parseFloat(rejectionQty) || 0;
  const numScrap = parseFloat(scrapQty) || 0;

  const reconciliation = stageResultBalance(numGood, numReject, numScrap, actualInward);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedDcId) return setError("Please select a Delivery Challan.");
    if (!reconciliation.isValid) {
      return setError(`Reconciliation Balance Error: Good (${numGood}) + Rejection (${numReject}) + Scrap (${numScrap}) = ${reconciliation.total}, which does not equal Actual Inward Qty (${actualInward}).`);
    }

    setLoading(true);

    const payload: SubmitQualityInspectionInput = {
      dcId: selectedDcId,
      goodQty: numGood,
      rejectionQty: numReject,
      scrapQty: numScrap,
      qualityDecision,
      inspectionRemarks: remarks.trim() || undefined,
    };

    const res = await submitQualityInspection(payload);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while submitting quality inspection.");
    } else {
      setSuccess(`Quality Inspection submitted successfully for DC ${selectedDc?.dcNumber}.`);
      setTimeout(() => router.push(`/dcs/${selectedDcId}`), 1200);
    }
  }

  return (
    <div className="space-y-6">
      {/* DC SELECTOR & LIFECYCLE REVIEW */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Select Pending DC for Quality Inspection</label>
        <select
          value={selectedDcId}
          onChange={(e) => {
            setSelectedDcId(e.target.value);
            const dc = dcs.find((d) => d.id === e.target.value);
            if (dc) {
              setGoodQty(String(dc.actualInwardQty));
              setRejectionQty("0");
              setScrapQty("0");
            }
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        >
          <option value="">-- Select Pending DC --</option>
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

      {/* QUALITY QUANTITY RECONCILIATION FORM */}
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

          {/* QUANTITY SECTION */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 mb-3 border-b pb-1">Quality Inspection Quantities</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Good Qty (PASSED) *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={goodQty}
                  onChange={(e) => setGoodQty(e.target.value)}
                  className="w-full rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-red-700 mb-1">Rejection Qty *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={rejectionQty}
                  onChange={(e) => setRejectionQty(e.target.value)}
                  className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-700 mb-1">Scrap Qty *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={scrapQty}
                  onChange={(e) => setScrapQty(e.target.value)}
                  className="w-full rounded-md border border-amber-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* LIVE RECONCILIATION BALANCE INDICATOR */}
          <div className={`rounded-lg p-4 border flex items-center justify-between text-sm ${reconciliation.isValid ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"}`}>
            <div className="flex items-center gap-3">
              {reconciliation.isValid ? (
                <Check className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              )}
              <div>
                <span className="font-semibold block">
                  {reconciliation.isValid ? "RECONCILIATION VALID (Balance: 0)" : `RECONCILIATION MISMATCH (Balance: ${reconciliation.balance})`}
                </span>
                <span className="text-xs opacity-90">
                  Good ({numGood}) + Rejection ({numReject}) + Scrap ({numScrap}) = {reconciliation.total} NOS (Actual Inward: {actualInward} NOS)
                </span>
              </div>
            </div>
            <div className="font-mono text-base font-bold">
              {reconciliation.isValid ? "100% RECONCILED" : "UNRECONCILED"}
            </div>
          </div>

          {/* DECISION & REMARKS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quality Decision *</label>
              <select
                value={qualityDecision}
                onChange={(e) => setQualityDecision(e.target.value as any)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="PASSED">PASSED (Full Acceptance)</option>
                <option value="PARTIAL_ACCEPTANCE">PARTIAL ACCEPTANCE</option>
                <option value="REJECTED">REJECTED (Full Rejection)</option>
                <option value="SCRAPPED">SCRAPPED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Inspection Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Inspection notes or defect details"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end border-t pt-4">
            <Button
              type="submit"
              disabled={loading || !reconciliation.isValid}
              className={`font-medium px-6 ${reconciliation.isValid ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting Quality Inspection...
                </span>
              ) : (
                "Submit Quality Inspection"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
