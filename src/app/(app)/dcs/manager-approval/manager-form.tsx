"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  reviewPreOutwardManagerApproval,
  reviewManagerApproval,
} from "@/server/dcs/extended-actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck, Check, X, RotateCcw, PauseCircle, FileText, CreditCard } from "lucide-react";

export interface DcOption {
  id: string;
  dcNumber: string;
  dcDate: string;
  vendorName: string;
  vendorAddress: string;
  vendorGst: string;
  woNumber: string;
  partNumber: string;
  partDescription: string;
  department: string;
  outwardQtyRw: number;
  returningFgQuantity: number;
  outwardWeight: number;
  outwardGatingWeight: number;
  outwardBoringWeight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  pricingBasis: string;
  ratePerQuantity: number;
  expectedAmount: number;
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
  preOutwardDcs: DcOption[];
  paymentDcs: DcOption[];
}

export function ManagerApprovalForm({ preOutwardDcs, paymentDcs }: Props) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"PRE_OUTWARD" | "PAYMENT">("PRE_OUTWARD");
  const [selectedDcId, setSelectedDcId] = useState("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentList = activeTab === "PRE_OUTWARD" ? preOutwardDcs : paymentDcs;
  const selectedDc = currentList.find((d) => d.id === selectedDcId);

  function handleTabSwitch(tab: "PRE_OUTWARD" | "PAYMENT") {
    setActiveTab(tab);
    setSelectedDcId("");
    setRemarks("");
    setError(null);
    setSuccess(null);
  }

  async function handlePreOutwardAction(action: "APPROVE" | "REJECT" | "SEND_BACK" | "HOLD") {
    setError(null);
    setSuccess(null);

    if (!selectedDcId) return setError("Please select a Delivery Challan.");

    if ((action === "SEND_BACK" || action === "REJECT") && !remarks.trim()) {
      return setError(`Remarks / reason are required for action '${action}'.`);
    }

    setLoading(true);

    const res = await reviewPreOutwardManagerApproval({
      dcId: selectedDcId,
      action,
      approvalRemarks: remarks.trim() || undefined,
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while completing Pre-Outward review.");
    } else {
      setSuccess(`Pre-Outward action '${action}' completed for DC ${selectedDc?.dcNumber}.`);
      setTimeout(() => router.refresh(), 1200);
    }
  }

  async function handlePaymentAction(action: "APPROVE" | "REJECT" | "SEND_BACK" | "HOLD") {
    setError(null);
    setSuccess(null);

    if (!selectedDcId) return setError("Please select a Delivery Challan.");

    if ((action === "SEND_BACK" || action === "REJECT") && !remarks.trim()) {
      return setError(`Remarks / reason are required for action '${action}'.`);
    }

    setLoading(true);

    const res = await reviewManagerApproval({
      dcId: selectedDcId,
      action,
      approvalRemarks: remarks.trim() || undefined,
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "An error occurred while completing Payment Approval review.");
    } else {
      setSuccess(`Payment action '${action}' completed for DC ${selectedDc?.dcNumber}.`);
      setTimeout(() => router.refresh(), 1200);
    }
  }

  return (
    <div className="space-y-6">
      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-lg p-1 gap-2">
        <button
          type="button"
          onClick={() => handleTabSwitch("PRE_OUTWARD")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-md transition-colors ${
            activeTab === "PRE_OUTWARD"
              ? "bg-blue-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="h-4 w-4" />
          TAB 1: PRE-OUTWARD APPROVALS ({preOutwardDcs.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("PAYMENT")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-md transition-colors ${
            activeTab === "PAYMENT"
              ? "bg-emerald-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          TAB 2: PAYMENT APPROVALS ({paymentDcs.length})
        </button>
      </div>

      {/* FEEDBACK NOTIFICATIONS */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 font-medium">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200 font-medium">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* DC SELECTOR */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          {activeTab === "PRE_OUTWARD" ? "Select DC Pending Pre-Outward Approval" : "Select DC Pending Payment Approval"}
        </label>

        <select
          value={selectedDcId}
          onChange={(e) => setSelectedDcId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        >
          <option value="">-- Select Pending DC --</option>
          {currentList.map((d) => (
            <option key={d.id} value={d.id}>
              {d.dcNumber} — {d.vendorName} (WO: {d.woNumber}, Outward Qty: {d.outwardQtyRw} NOS, Amount: ₹{d.expectedAmount})
            </option>
          ))}
        </select>

        {currentList.length === 0 && (
          <p className="text-xs text-slate-400 italic">No Delivery Challans currently awaiting this manager approval stage.</p>
        )}
      </div>

      {/* TAB 1: PRE-OUTWARD REVIEW PANEL */}
      {activeTab === "PRE_OUTWARD" && selectedDc && (
        <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 bg-blue-50 p-3 rounded-md border border-blue-200">
            <ShieldCheck className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span>Pre-Outward Review: Approve commercial rates, outward quantities, and supplier details BEFORE material leaves factory gate.</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans border-b pb-4">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Supplier Name</span>
              <span className="font-bold text-slate-900">{selectedDc.vendorName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">GST Number</span>
              <span className="font-mono text-slate-800">{selectedDc.vendorGst}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Work Order</span>
              <span className="font-mono font-bold text-slate-900">{selectedDc.woNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Part Number</span>
              <span className="font-mono font-bold text-slate-900">{selectedDc.partNumber}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Supplier Address</span>
              <span className="text-slate-700">{selectedDc.vendorAddress}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Department</span>
              <span className="font-semibold text-slate-900">{selectedDc.department}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">DC Date</span>
              <span className="font-semibold text-slate-900">{selectedDc.dcDate}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans border-b pb-4">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Outward Qty RW</span>
              <span className="font-mono font-bold text-blue-900 text-sm">{selectedDc.outwardQtyRw} NOS</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Returning FG Qty</span>
              <span className="font-mono font-bold text-blue-900 text-sm">{selectedDc.returningFgQuantity} NOS</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Outward Gross Weight</span>
              <span className="font-mono text-slate-800">{selectedDc.outwardWeight} KG</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Gating / Boring Wt</span>
              <span className="font-mono text-slate-800">{selectedDc.outwardGatingWeight} KG / {selectedDc.outwardBoringWeight} KG</span>
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50/60 p-4 border border-emerald-200 text-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Commercial Pricing Review</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block text-[10px]">Pricing Basis</span>
                <span className="font-bold text-slate-900">{selectedDc.pricingBasis === "RW" ? "RW Quantity" : "Returning FG Quantity"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Rate Per Quantity</span>
                <span className="font-mono font-bold text-slate-900">₹{selectedDc.ratePerQuantity} / NOS</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Calculated Expected Amount</span>
                <span className="font-mono font-bold text-emerald-900 text-sm">₹{selectedDc.expectedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Pre-Outward Remarks / Reason</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Mandatory for Send Back or Reject"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handlePreOutwardAction("HOLD")}
              disabled={loading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              <PauseCircle className="h-4 w-4 mr-1 text-slate-500" />
              HOLD
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handlePreOutwardAction("SEND_BACK")}
              disabled={loading}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300"
            >
              <RotateCcw className="h-4 w-4 mr-1 text-amber-600" />
              SEND BACK TO CREATOR
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handlePreOutwardAction("REJECT")}
              disabled={loading}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300"
            >
              <X className="h-4 w-4 mr-1 text-red-600" />
              REJECT DC
            </Button>
            <Button
              type="button"
              onClick={() => handlePreOutwardAction("APPROVE")}
              disabled={loading}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  APPROVE PRE-OUTWARD
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: POST-QUALITY PAYMENT REVIEW PANEL */}
      {activeTab === "PAYMENT" && selectedDc && (
        <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 bg-emerald-50 p-3 rounded-md border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>Payment Review: Verify Quality Department outputs before authorizing Accounts payment entry. Manager cannot alter Quality quantities.</span>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 mb-3 border-b pb-1">Quality Inspection Summary (Locked Output)</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="rounded-md bg-emerald-50 p-3 border border-emerald-200">
                <span className="text-emerald-700 font-semibold block text-[10px] uppercase">GOOD QTY</span>
                <span className="text-lg font-bold text-emerald-900">{selectedDc.goodQty} NOS</span>
              </div>
              <div className="rounded-md bg-red-50 p-3 border border-red-200">
                <span className="text-red-700 font-semibold block text-[10px] uppercase">REJECTION QTY</span>
                <span className="text-lg font-bold text-red-900">{selectedDc.rejectionQty} NOS</span>
              </div>
              <div className="rounded-md bg-amber-50 p-3 border border-amber-200">
                <span className="text-amber-700 font-semibold block text-[10px] uppercase">SCRAP QTY</span>
                <span className="text-lg font-bold text-amber-900">{selectedDc.scrapQty} NOS</span>
              </div>
              <div className="rounded-md bg-blue-50 p-3 border border-blue-200">
                <span className="text-blue-700 font-semibold block text-[10px] uppercase">QUALITY DECISION</span>
                <span className="text-sm font-bold text-blue-900 mt-1 block">{selectedDc.qualityDecision}</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Inspector Remarks:</span> {selectedDc.inspectionRemarks}
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50/60 p-4 border border-emerald-200 text-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Payment Commercial Summary</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block text-[10px]">Pricing Basis</span>
                <span className="font-bold text-slate-900">{selectedDc.pricingBasis === "RW" ? "RW Quantity" : "Returning FG Quantity"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Rate</span>
                <span className="font-mono font-bold text-slate-900">₹{selectedDc.ratePerQuantity} / NOS</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Commercial Amount</span>
                <span className="font-mono font-bold text-emerald-900 text-sm">₹{selectedDc.expectedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Manager Payment Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Payment remarks or approval notes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handlePaymentAction("HOLD")}
              disabled={loading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              <PauseCircle className="h-4 w-4 mr-1 text-slate-500" />
              HOLD
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handlePaymentAction("SEND_BACK")}
              disabled={loading}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300"
            >
              <RotateCcw className="h-4 w-4 mr-1 text-amber-600" />
              SEND BACK
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handlePaymentAction("REJECT")}
              disabled={loading}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300"
            >
              <X className="h-4 w-4 mr-1 text-red-600" />
              REJECT
            </Button>
            <Button
              type="button"
              onClick={() => handlePaymentAction("APPROVE")}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  APPROVE FOR PAYMENT
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
