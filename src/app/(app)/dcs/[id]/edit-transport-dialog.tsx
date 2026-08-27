"use client";

import { useState } from "react";
import { updateDcTransportDetails } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditTransportDialogProps {
  dcId: string;
  vehicleNumber?: string | null;
  transporter?: string | null;
  ewayBillNumber?: string | null;
  eSugamNumber?: string | null;
}

export function EditTransportDialog({
  dcId,
  vehicleNumber: initialVehicle = "",
  transporter: initialTransporter = "",
  ewayBillNumber: initialEway = "",
  eSugamNumber: initialEsugam = "",
}: EditTransportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState(initialVehicle ?? "");
  const [transporter, setTransporter] = useState(initialTransporter ?? "");
  const [ewayBillNumber, setEwayBillNumber] = useState(initialEway ?? "");
  const [eSugamNumber, setESugamNumber] = useState(initialEsugam ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await updateDcTransportDetails(dcId, {
      vehicleNumber,
      transporter,
      ewayBillNumber,
      eSugamNumber,
    });

    setLoading(false);

    if (!res.ok) {
      setError(res.error || "Failed to update transport details.");
      return;
    }

    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded border border-blue-200 hover:border-blue-300"
      >
        Edit Transport / E-Way / E-Sugam
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Transport &amp; E-Way / E-Sugam Details</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Vehicle Number
                </label>
                <Input
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g. KA-01-AB-1234"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Transporter Name
                </label>
                <Input
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  placeholder="e.g. BlueDart Logistics"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  E-Way Bill Number
                </label>
                <Input
                  value={ewayBillNumber}
                  onChange={(e) => setEwayBillNumber(e.target.value)}
                  placeholder="Enter E-Way Bill Number"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  E-Sugam Number
                </label>
                <Input
                  value={eSugamNumber}
                  onChange={(e) => setESugamNumber(e.target.value)}
                  placeholder="Enter E-Sugam Number"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Details"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
