"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitForApproval, approveDc, dispatchDc } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function DcActions({ dcId, status, canApprove, canSubmit, canDispatch }: {
  dcId: string; status: string; canApprove: boolean; canSubmit: boolean; canDispatch: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporter, setTransporter] = useState("");

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvedByName, setApprovedByName] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Action failed."); return; }
    router.refresh();
  }

  function handleOpenApproveModal() {
    setApprovedByName("");
    setApproveError(null);
    setShowApproveModal(true);
  }

  async function handleConfirmApprove() {
    const trimmed = approvedByName.trim();
    if (!trimmed) {
      setApproveError("Approved By Name is required.");
      return;
    }

    setApproving(true);
    setApproveError(null);

    const res = await approveDc(dcId, trimmed);
    setApproving(false);

    if (!res.ok) {
      setApproveError(res.error ?? "Approval failed.");
    } else {
      setShowApproveModal(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {status === "DRAFT" && canSubmit && (
          <Button disabled={busy} onClick={() => run(() => submitForApproval(dcId))}>
            Submit for Approval
          </Button>
        )}
        {status === "PENDING_APPROVAL" && canApprove && (
          <Button disabled={busy} onClick={handleOpenApproveModal}>
            Approve
          </Button>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* APPROVAL MODAL */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Approve Delivery Challan
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter the name of the authorized person approving this Delivery Challan. This will be printed on the official PDF.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Approved By Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={approvedByName}
                  onChange={(e) => setApprovedByName(e.target.value)}
                  placeholder="Enter name to appear on DC (e.g. Aravind Gurudev)"
                  className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  autoFocus
                />
                <p className="text-xs text-slate-400">
                  Do not leave blank. This must be manually typed.
                </p>
              </div>

              {approveError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">
                  {approveError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowApproveModal(false)}
                disabled={approving}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmApprove}
                disabled={approving}
                className="h-9 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
              >
                {approving ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Approving...
                  </span>
                ) : (
                  "Approve DC"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {status === "APPROVED" && canDispatch && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Dispatch</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Vehicle Number</label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. KA-01-AB-1234" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Transporter</label>
              <Input value={transporter} onChange={(e) => setTransporter(e.target.value)} placeholder="e.g. BlueDart Logistics" />
            </div>
          </div>
          <div className="mt-3">
            <Button
              disabled={busy}
              onClick={() =>
                run(() =>
                  dispatchDc(dcId, {
                    vehicleNumber: vehicleNumber || undefined,
                    transporter: transporter || undefined,
                  }),
                )
              }
            >
              {busy ? "Dispatching…" : "Dispatch"}
            </Button>
          </div>
        </div>
      )}

      {status === "APPROVED" && !canDispatch && (
        <span className="text-sm text-slate-500">Approved — waiting on dispatch (requires DC_DISPATCH permission).</span>
      )}
    </div>
  );
}