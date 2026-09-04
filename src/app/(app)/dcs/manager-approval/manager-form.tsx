"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewManagerApproval, ReviewManagerApprovalInput } from "@/server/dcs/extended-actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck, Check, X, RotateCcw, PauseCircle } from "lucide-react";

interface DcOption {
  id: string;
  dcNumber: string;
  vendorName: string;
  woNumber: string;
  partNumber: string;
  department: string;
  actualInwardQty: number;
  storeReceivedQty: number;
  goodQty: number;
  rejectionQty: number;
  scrapQty: number;
  qualityDecision: string;
  inspectionRemarks: string;
  status: string;
}

interface Props {
  dcs: DcOption[];
}

export function ManagerApprovalForm({ dcs }: Props) {
  const router = useRouter();

  const [selectedDcId, setSelectedDcId] = useState("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedDc = dcs.find((d) => d.id === selectedDcId);

  async function handleManagerAction(action: "APPROVE" | "REJECT" | "SEND_BACK" | "HOLD") {
    setError(null);
    setSuccess(null);

    if (!selectedDcId) return setError("Please select a Delivery Challan.");

    setLoading(true);

    const payload: ReviewManagerApprovalInput = {
      dcId: selectedDcId,
      action,
      approvalRemarks: remarks.trim() || undefined,
    };

    const res = await reviewManagerApproval(payload);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while performing manager review.");
    } else {
      setSuccess(`Manager action '${action}' completed for DC ${selectedDc?.dcNumber}.`);
      setTimeout(() => router.push(`/dcs/${selectedDcId}`), 1200);
    }
  }

  return (
    <div className="space-y-6">
      {/* DC SELECTOR */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Select DC Pending Manager Approval</label>
        <select
          value={selectedDcId}
          onChange={(e) => setSelectedDcId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        >
          <option value="">-- Select Pending DC --</option>
          {dcs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.dcNumber} — {d.vendorName} (WO: {d.woNumber}, Good: {d.goodQty}, Decision: {d.qualityDecision})
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
              <span className="text-slate-500 block">Actual Inward Qty</span>
              <span className="font-bold text-slate-900">{selectedDc.actualInwardQty} NOS</span>
            </div>
            <div>
              <span className="text-slate-500 block">Current Status</span>
              <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-medium text-[11px]">
                {selectedDc.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* READ-ONLY LIFECYCLE & QUALITY REVIEW */}
      {selectedDc && (
        <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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
            <span>Manager Governance Policy: Quality inspection quantities are locked and read-only. Review all data before approval.</span>
          </div>

          {/* QUALITY SUMMARY CARDS (READ-ONLY) */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 mb-3 border-b pb-1">Quality Inspection Summary (Locked)</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="rounded-md bg-emerald-50 p-3 border border-emerald-200">
                <span className="text-emerald-700 font-semibold block">GOOD QTY</span>
                <span className="text-lg font-bold text-emerald-900">{selectedDc.goodQty} NOS</span>
              </div>
              <div className="rounded-md bg-red-50 p-3 border border-red-200">
                <span className="text-red-700 font-semibold block">REJECTION QTY</span>
                <span className="text-lg font-bold text-red-900">{selectedDc.rejectionQty} NOS</span>
              </div>
              <div className="rounded-md bg-amber-50 p-3 border border-amber-200">
                <span className="text-amber-700 font-semibold block">SCRAP QTY</span>
                <span className="text-lg font-bold text-amber-900">{selectedDc.scrapQty} NOS</span>
              </div>
              <div className="rounded-md bg-blue-50 p-3 border border-blue-200">
                <span className="text-blue-700 font-semibold block">QUALITY DECISION</span>
                <span className="text-sm font-bold text-blue-900 mt-1 block">{selectedDc.qualityDecision}</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Inspector Remarks:</span> {selectedDc.inspectionRemarks}
            </div>
          </div>

          {/* MANAGER REMARKS */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Manager Decision Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Approval comments, rejection reason, or send-back instructions"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleManagerAction("HOLD")}
              disabled={loading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              <PauseCircle className="h-4 w-4 mr-1 text-slate-500" />
              HOLD
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleManagerAction("SEND_BACK")}
              disabled={loading}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300"
            >
              <RotateCcw className="h-4 w-4 mr-1 text-amber-600" />
              SEND BACK
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleManagerAction("REJECT")}
              disabled={loading}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300"
            >
              <X className="h-4 w-4 mr-1 text-red-600" />
              REJECT
            </Button>
            <Button
              type="button"
              onClick={() => handleManagerAction("APPROVE")}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  APPROVE PAYMENT
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
