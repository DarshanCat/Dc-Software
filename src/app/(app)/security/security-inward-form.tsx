"use client";

import { useState } from "react";
import { submitSecurityReturn } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface SecurityInwardFormProps {
  dc: {
    id: string;
    dcNumber: string;
    partNumber?: string | null;
    rmQuantity?: number | string | null;
    returnFgQuantity?: number | string | null;
    vendorName?: string;
  };
  onSuccess?: () => void;
}

export function SecurityInwardForm({ dc, onSuccess }: SecurityInwardFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  const [returnDate, setReturnDate] = useState(todayStr);
  const [returnTime, setReturnTime] = useState(timeStr);
  const [fgQuantity, setFgQuantity] = useState<number | "">(
    dc.returnFgQuantity != null ? Number(dc.returnFgQuantity) : 0,
  );
  const [rejectionQuantity, setRejectionQuantity] = useState<number | "">(0);
  const [scrapQuantity, setScrapQuantity] = useState<number | "">(0);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporter, setTransporter] = useState("");
  const [remarks, setRemarks] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fg = fgQuantity === "" ? 0 : Number(fgQuantity);
    const rej = rejectionQuantity === "" ? 0 : Number(rejectionQuantity);
    const scrap = scrapQuantity === "" ? 0 : Number(scrapQuantity);

    if (fg < 0 || rej < 0 || scrap < 0) {
      setError("Quantities cannot be negative.");
      return;
    }
    if (!returnDate || !returnTime) {
      setError("Return Date and Return Time are mandatory.");
      return;
    }

    setLoading(true);

    try {
      const res = await submitSecurityReturn(dc.id, {
        securityFgQuantity: fg,
        securityRejectionQuantity: rej,
        securityScrapQuantity: scrap,
        returnDate,
        returnTime,
        vehicleNumber: vehicleNumber.trim() || undefined,
        transporter: transporter.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      if (!res.ok) {
        setError(res.error || "Failed to submit material return.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        if (onSuccess) onSuccess();
        router.refresh();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          setError(null);
          setSuccess(false);
        }}
        className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-sm"
      >
        ENTER MATERIAL INWARD
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Material Inward / Gate Return Entry</h3>
                <p className="text-xs text-slate-500 font-mono">DC: {dc.dcNumber} — Vendor: {dc.vendorName || "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-xs font-semibold text-red-800 border border-red-200">
                {error}
              </div>
            )}

            {success ? (
              <div className="rounded-md bg-emerald-50 p-4 text-center text-xs font-bold text-emerald-900 border border-emerald-300 space-y-1">
                <p className="text-sm font-extrabold text-emerald-950">✓ Material Return Recorded Successfully!</p>
                <p className="text-slate-600">Status updated to SECURITY_RETURNED. Forwarding to Stores...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                  <div>
                    <span className="text-slate-500 font-medium">Part Number:</span>
                    <p className="font-mono font-bold text-slate-900">{dc.partNumber || "—"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Sent RM Quantity:</span>
                    <p className="font-mono font-bold text-slate-900">{dc.rmQuantity != null ? Number(dc.rmQuantity).toFixed(3) : "—"} kg</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Return Date *</label>
                    <input
                      type="date"
                      required
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full rounded border border-slate-300 p-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Return Time *</label>
                    <input
                      type="time"
                      required
                      value={returnTime}
                      onChange={(e) => setReturnTime(e.target.value)}
                      className="w-full rounded border border-slate-300 p-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <p className="font-bold text-slate-900 uppercase tracking-wider mb-2">Gate Return Quantities (Security Entry)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">FG Quantity *</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        required
                        value={fgQuantity}
                        onChange={(e) => setFgQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full rounded border border-slate-300 p-2 text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rejection Qty *</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        required
                        value={rejectionQuantity}
                        onChange={(e) => setRejectionQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full rounded border border-slate-300 p-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Scrap Qty *</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        required
                        value={scrapQuantity}
                        onChange={(e) => setScrapQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full rounded border border-slate-300 p-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vehicle Number</label>
                    <input
                      type="text"
                      placeholder="e.g. KA-05-AB-1234"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full rounded border border-slate-300 p-2 text-xs uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
                    <input
                      type="text"
                      placeholder="e.g. VRL Logistics"
                      value={transporter}
                      onChange={(e) => setTransporter(e.target.value)}
                      className="w-full rounded border border-slate-300 p-2 text-xs font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Return Remarks</label>
                  <textarea
                    rows={2}
                    placeholder="Gate entry verification notes..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full rounded border border-slate-300 p-2 text-xs font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm"
                  >
                    {loading ? "Saving Material Return..." : "SUBMIT MATERIAL INWARD"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
