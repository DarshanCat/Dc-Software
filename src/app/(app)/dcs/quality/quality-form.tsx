"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { submitQualityInspection, SubmitQualityInspectionInput } from "@/server/dcs/extended-actions";
import { stageResultBalance } from "@/analytics/math-engine";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Check, XCircle, Search, X, ChevronRight } from "lucide-react";

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
  initialSelectedDcId?: string;
  initialSearchQuery?: string;
}

export function QualityInspectionForm({ dcs, initialSelectedDcId = "", initialSearchQuery = "" }: Props) {
  const router = useRouter();

  const [selectedDcId, setSelectedDcId] = useState(initialSelectedDcId);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [goodQty, setGoodQty] = useState<string>("");
  const [rejectionQty, setRejectionQty] = useState<string>("");
  const [scrapQty, setScrapQty] = useState<string>("");
  const [qualityDecision, setQualityDecision] = useState<"PASSED" | "PARTIAL_ACCEPTANCE" | "REJECTED" | "SCRAPPED">("PASSED");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredDcs = useMemo(() => {
    if (!searchQuery.trim()) return dcs;
    const q = searchQuery.toLowerCase().trim();
    return dcs.filter(
      (d) =>
        d.woNumber.toLowerCase().includes(q) ||
        d.dcNumber.toLowerCase().includes(q) ||
        d.partNumber.toLowerCase().includes(q) ||
        d.vendorName.toLowerCase().includes(q) ||
        d.department.toLowerCase().includes(q)
    );
  }, [dcs, searchQuery]);

  const selectedDc = dcs.find((d) => d.id === selectedDcId);
  const actualInward = selectedDc ? selectedDc.actualInwardQty : 0;
  const storeReceived = selectedDc ? (selectedDc.storeReceivedQty ?? selectedDc.actualInwardQty) : 0;

  const numGood = parseFloat(goodQty) || 0;
  const numReject = parseFloat(rejectionQty) || 0;
  const numScrap = parseFloat(scrapQty) || 0;

  const reconciliation = stageResultBalance(numGood, numReject, numScrap, storeReceived);

  function handleSelectDc(dcId: string) {
    setSelectedDcId(dcId);
    setGoodQty("");
    setRejectionQty("");
    setScrapQty("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedDcId) return setError("Please select a Delivery Challan.");
    if (!reconciliation.isValid || (numGood + numReject + numScrap) !== storeReceived) {
      return setError(`Good + Rejection + Scrap (${numGood + numReject + numScrap}) must equal the Store Received Qty (${storeReceived}).`);
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
      {/* DC SEARCH & SELECTION SECTION */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Select Pending DC for Quality Inspection
            </h2>
            <p className="text-xs text-slate-500">
              Search by Work Order ID (WO ID), DC Number, Part Number, or Supplier.
            </p>
          </div>
          {selectedDc && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleSelectDc("")}
              className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              ✕ Change DC / Search Another
            </Button>
          )}
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type WO ID (e.g. WO-2026), DC Number, Part Number, or Vendor to search..."
            className="w-full rounded-md border border-slate-300 pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* SEARCH QUICK SELECTOR DROPDOWN */}
        <div>
          <select
            value={selectedDcId}
            onChange={(e) => handleSelectDc(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">
              -- Select Pending DC ({filteredDcs.length} found) --
            </option>
            {filteredDcs.map((d) => (
              <option key={d.id} value={d.id}>
                WO: {d.woNumber} | DC: {d.dcNumber} — {d.vendorName} (Part: {d.partNumber}, Rec: {d.storeReceivedQty ?? d.actualInwardQty} NOS)
              </option>
            ))}
          </select>
        </div>

        {/* SEARCH MATCHES CARDS LIST (WHEN NO DC SELECTED OR SEARCHING) */}
        {!selectedDc && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Pending DCs Queue ({filteredDcs.length} available)</span>
              {searchQuery && <span className="text-blue-600">Filtered by &quot;{searchQuery}&quot;</span>}
            </div>

            {filteredDcs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No pending DCs found matching &quot;{searchQuery}&quot;. Please check the Work Order ID or DC Number.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {filteredDcs.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleSelectDc(d.id)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50/60 p-3 hover:bg-blue-50/50 hover:border-blue-300 transition-all text-xs space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 group-hover:text-blue-900 text-sm">
                        {d.dcNumber}
                      </span>
                      <span className="rounded bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 text-[11px] border border-indigo-200">
                        WO: {d.woNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">{d.vendorName}</span>
                      <span className="font-mono text-slate-700 font-medium">Part: {d.partNumber}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-[11px]">
                      <span className="text-slate-500">
                        Inward Qty: <strong className="text-blue-800">{d.storeReceivedQty ?? d.actualInwardQty} NOS</strong>
                      </span>
                      <span className="inline-flex items-center font-bold text-blue-700 group-hover:translate-x-0.5 transition-transform">
                        Select for Inspection <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SELECTED DC DETAIL BANNER */}
        {selectedDc && (
          <div className="rounded-lg bg-blue-50/70 p-4 border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Selected DC for Inspection
              </span>
              <span className="rounded bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 text-xs border border-emerald-300">
                Ready for Quality Inspection
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">DC Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{selectedDc.dcNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Work Order ID (WO)</span>
                <span className="font-mono font-bold text-indigo-900 text-sm">{selectedDc.woNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Supplier / Part</span>
                <span className="font-semibold text-slate-900 block truncate">{selectedDc.vendorName}</span>
                <span className="font-mono text-slate-600 text-[11px]">{selectedDc.partNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Department</span>
                <span className="font-semibold text-slate-900">{selectedDc.department}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Store Received Qty</span>
                <span className="font-mono font-bold text-blue-800 text-base">
                  {selectedDc.storeReceivedQty ?? selectedDc.actualInwardQty} NOS
                </span>
              </div>
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
                  placeholder="Enter good qty"
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
                  placeholder="Enter rejection qty"
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
                  placeholder="Enter scrap qty"
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
                  Good ({numGood}) + Rejection ({numReject}) + Scrap ({numScrap}) = {reconciliation.total} NOS (Store Received: {storeReceived} NOS)
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
