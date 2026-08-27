"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  submitForApproval,
  rejectDcToDraft,
  approveDc,
  submitSecurityDispatch,
  confirmDcAtVendor,
  submitSecurityReturn,
  submitStoreVerification,
  submitManagerFinalApproval,
  submitPaymentApproval,
  submitAccountsPaymentEntry,
  closeDc,
} from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function DcActions({
  dcId,
  status,
  userRole,
  permissions,
  dcData,
}: {
  dcId: string;
  status: string;
  userRole: string;
  permissions: {
    canSubmit: boolean;
    canApprove: boolean;
    canSecurityDispatch: boolean;
    canConfirmVendor: boolean;
    canSecurityReturn: boolean;
    canStoreVerify: boolean;
    canManagerFinalApprove: boolean;
    canPaymentApprove: boolean;
    canAccountsEntry: boolean;
    canClose: boolean;
  };
  dcData: {
    rmQuantity?: number | null;
    returnFgQuantity?: number | null;
    securityDispatchQuantity?: number | null;
    securityFgQuantity?: number | null;
    securityRejectionQuantity?: number | null;
    securityScrapQuantity?: number | null;
    storeVerifiedFgQuantity?: number | null;
    storeVerifiedRejectionQuantity?: number | null;
    storeVerifiedScrapQuantity?: number | null;
    invoiceNumber?: string | null;
    invoiceAmount?: number | null;
    paymentReferenceNumber?: string | null;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [modal, setModal] = useState<
    | "APPROVE"
    | "REJECT_DRAFT"
    | "DISPATCH"
    | "SEC_RETURN"
    | "STORE_VERIFY"
    | "FINAL_APPROVE"
    | "ACCOUNTS_ENTRY"
    | null
  >(null);

  // Modal Inputs
  const [approvedByName, setApprovedByName] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Security Dispatch
  const [dispatchQty, setDispatchQty] = useState(String(dcData.rmQuantity || ""));
  const [dispatchVehicle, setDispatchVehicle] = useState("");
  const [dispatchTransporter, setDispatchTransporter] = useState("");
  const [dispatchRemarks, setDispatchRemarks] = useState("");

  // Security Return
  const [secFg, setSecFg] = useState(String(dcData.returnFgQuantity || ""));
  const [secRej, setSecRej] = useState("0");
  const [secScrap, setSecScrap] = useState("0");
  const [secVehicle, setSecVehicle] = useState("");
  const [secRemarks, setSecRemarks] = useState("");

  // Store Verification
  const [storeFg, setStoreFg] = useState(String(dcData.returnFgQuantity || ""));
  const [storeRej, setStoreRej] = useState("0");
  const [storeScrap, setStoreScrap] = useState("0");
  const [storeRemarks, setStoreRemarks] = useState("");

  // Manager Final Approval
  const [finalFg, setFinalFg] = useState(String(dcData.returnFgQuantity || ""));
  const [finalRej, setFinalRej] = useState("0");
  const [finalScrap, setFinalScrap] = useState("0");
  const [managerRemarks, setManagerRemarks] = useState("");

  // Accounts Payment Entry
  const [invNum, setInvNum] = useState(dcData.invoiceNumber || "");
  const [invDate, setInvDate] = useState(new Date().toISOString().split("T")[0]);
  const [invAmount, setInvAmount] = useState(String(dcData.invoiceAmount || ""));
  const [payRef, setPayRef] = useState(dcData.paymentReferenceNumber || "");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payRemarks, setPayRemarks] = useState("");

  async function handleAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Action failed.");
    } else {
      setModal(null);
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">DC Lifecycle Action Panel</h2>
          <p className="text-xs text-slate-500">Perform the next required workflow step based on your assigned role.</p>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
          Status: {status.replace(/_/g, " ")}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* 1. DRAFT -> PENDING_APPROVAL */}
        {status === "DRAFT" && permissions.canSubmit && (
          <Button disabled={busy} onClick={() => handleAction(() => submitForApproval(dcId))} className="bg-blue-600 text-white hover:bg-blue-700">
            Submit for Approval
          </Button>
        )}

        {/* 2. PENDING_APPROVAL -> APPROVED / DRAFT */}
        {status === "PENDING_APPROVAL" && permissions.canApprove && (
          <>
            <Button disabled={busy} onClick={() => setModal("APPROVE")} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              Approve DC
            </Button>
            <Button disabled={busy} variant="secondary" onClick={() => setModal("REJECT_DRAFT")} className="border-red-300 text-red-700 hover:bg-red-50">
              Return to Draft
            </Button>
          </>
        )}

        {/* 3. APPROVED -> DISPATCHED */}
        {status === "APPROVED" && permissions.canSecurityDispatch && (
          <Button disabled={busy} onClick={() => setModal("DISPATCH")} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Security Dispatch Entry
          </Button>
        )}

        {/* 4. DISPATCHED -> AT_VENDOR */}
        {status === "DISPATCHED" && permissions.canConfirmVendor && (
          <Button disabled={busy} onClick={() => handleAction(() => confirmDcAtVendor(dcId))} className="bg-purple-600 hover:bg-purple-700 text-white">
            Confirm Vendor Receipt (At Vendor)
          </Button>
        )}

        {/* 5. AT_VENDOR / DISPATCHED -> SECURITY_RETURNED */}
        {["DISPATCHED", "AT_VENDOR"].includes(status) && permissions.canSecurityReturn && (
          <Button disabled={busy} onClick={() => setModal("SEC_RETURN")} className="bg-amber-600 hover:bg-amber-700 text-white">
            Security Return Entry
          </Button>
        )}

        {/* 6. SECURITY_RETURNED -> STORE_VERIFIED */}
        {status === "SECURITY_RETURNED" && permissions.canStoreVerify && (
          <Button disabled={busy} onClick={() => setModal("STORE_VERIFY")} className="bg-cyan-700 hover:bg-cyan-800 text-white">
            Store Material Verification
          </Button>
        )}

        {/* 7. STORE_VERIFIED -> FINAL_APPROVED */}
        {status === "STORE_VERIFIED" && permissions.canManagerFinalApprove && (
          <Button disabled={busy} onClick={() => setModal("FINAL_APPROVE")} className="bg-teal-700 hover:bg-teal-800 text-white">
            Manager Final Approval &amp; Quantities
          </Button>
        )}

        {/* 8. FINAL_APPROVED -> APPROVED_FOR_PAYMENT */}
        {status === "FINAL_APPROVED" && permissions.canPaymentApprove && (
          <Button disabled={busy} onClick={() => handleAction(() => submitPaymentApproval(dcId))} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            Approve for Payment
          </Button>
        )}

        {/* 9. APPROVED_FOR_PAYMENT -> ACCOUNTS ENTRY & CLOSE */}
        {status === "APPROVED_FOR_PAYMENT" && (
          <>
            {permissions.canAccountsEntry && (
              <Button disabled={busy} onClick={() => setModal("ACCOUNTS_ENTRY")} className="bg-blue-800 hover:bg-blue-900 text-white">
                Enter Invoice &amp; Payment Details
              </Button>
            )}
            {permissions.canClose && (
              <Button disabled={busy} onClick={() => handleAction(() => closeDc(dcId))} className="bg-red-700 hover:bg-red-800 text-white font-bold">
                CLOSE DC
              </Button>
            )}
          </>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* APPROVE MODAL */}
      {modal === "APPROVE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Approve Delivery Challan</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Approved By Name *</label>
              <Input
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                placeholder="Enter name to appear on official PDF"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button onClick={() => handleAction(() => approveDc(dcId, approvedByName))} disabled={busy} className="bg-emerald-700 text-white">
                Confirm Approval
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT TO DRAFT MODAL */}
      {modal === "REJECT_DRAFT" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Return DC to Draft</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Return Remarks / Reason *</label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Specify reason for returning for correction"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button onClick={() => handleAction(() => rejectDcToDraft(dcId, rejectReason))} disabled={busy} className="bg-red-600 text-white">
                Return to Draft
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH MODAL */}
      {modal === "DISPATCH" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Security Dispatch Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Dispatched Quantity *</label>
                <Input
                  type="number"
                  step="0.001"
                  value={dispatchQty}
                  onChange={(e) => setDispatchQty(e.target.value)}
                  placeholder="Enter actual quantity dispatched"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Number</label>
                <Input value={dispatchVehicle} onChange={(e) => setDispatchVehicle(e.target.value)} placeholder="e.g. KA-01-AB-1234" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transporter</label>
                <Input value={dispatchTransporter} onChange={(e) => setDispatchTransporter(e.target.value)} placeholder="e.g. VRL Logistics" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Remarks</label>
                <Input value={dispatchRemarks} onChange={(e) => setDispatchRemarks(e.target.value)} placeholder="Optional gate remarks" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() =>
                  handleAction(() =>
                    submitSecurityDispatch(dcId, {
                      dispatchQuantity: Number(dispatchQty),
                      vehicleNumber: dispatchVehicle,
                      transporter: dispatchTransporter,
                      remarks: dispatchRemarks,
                    }),
                  )
                }
                disabled={busy}
                className="bg-indigo-600 text-white"
              >
                Submit Dispatch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY RETURN MODAL */}
      {modal === "SEC_RETURN" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Security Gate Return Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Returned FG Quantity *</label>
                <Input type="number" step="0.001" value={secFg} onChange={(e) => setSecFg(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rejection Quantity *</label>
                <Input type="number" step="0.001" value={secRej} onChange={(e) => setSecRej(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scrap Quantity *</label>
                <Input type="number" step="0.001" value={secScrap} onChange={(e) => setSecScrap(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Return Vehicle Number</label>
                <Input value={secVehicle} onChange={(e) => setSecVehicle(e.target.value)} placeholder="e.g. KA-02-CD-5678" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Security Gate Remarks</label>
                <Input value={secRemarks} onChange={(e) => setSecRemarks(e.target.value)} placeholder="Gate return remarks" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() =>
                  handleAction(() =>
                    submitSecurityReturn(dcId, {
                      securityFgQuantity: Number(secFg),
                      securityRejectionQuantity: Number(secRej),
                      securityScrapQuantity: Number(secScrap),
                      vehicleNumber: secVehicle,
                      remarks: secRemarks,
                    }),
                  )
                }
                disabled={busy}
                className="bg-amber-600 text-white"
              >
                Submit Security Return
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STORE VERIFICATION MODAL */}
      {modal === "STORE_VERIFY" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Store Verification Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Verified FG Quantity *</label>
                <Input type="number" step="0.001" value={storeFg} onChange={(e) => setStoreFg(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Verified Rejection Quantity *</label>
                <Input type="number" step="0.001" value={storeRej} onChange={(e) => setStoreRej(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Verified Scrap Quantity *</label>
                <Input type="number" step="0.001" value={storeScrap} onChange={(e) => setStoreScrap(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Inspection Remarks</label>
                <Input value={storeRemarks} onChange={(e) => setStoreRemarks(e.target.value)} placeholder="Store verification notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() =>
                  handleAction(() =>
                    submitStoreVerification(dcId, {
                      storeVerifiedFgQuantity: Number(storeFg),
                      storeVerifiedRejectionQuantity: Number(storeRej),
                      storeVerifiedScrapQuantity: Number(storeScrap),
                      storeRemarks,
                    }),
                  )
                }
                disabled={busy}
                className="bg-cyan-700 text-white"
              >
                Submit Store Verification
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGER FINAL APPROVAL MODAL */}
      {modal === "FINAL_APPROVE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Manager Final Approval &amp; Quantities</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Final Approved FG *</label>
                  <Input type="number" step="0.001" value={finalFg} onChange={(e) => setFinalFg(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Final Approved Rejection *</label>
                  <Input type="number" step="0.001" value={finalRej} onChange={(e) => setFinalRej(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Final Approved Scrap *</label>
                  <Input type="number" step="0.001" value={finalScrap} onChange={(e) => setFinalScrap(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Manager Correction Remarks</label>
                <Input
                  value={managerRemarks}
                  onChange={(e) => setManagerRemarks(e.target.value)}
                  placeholder="Mandatory if Security and Store quantities differ or process loss occurred"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() =>
                  handleAction(() =>
                    submitManagerFinalApproval(dcId, {
                      finalApprovedFgQuantity: Number(finalFg),
                      finalApprovedRejectionQuantity: Number(finalRej),
                      finalApprovedScrapQuantity: Number(finalScrap),
                      managerCorrectionRemarks: managerRemarks,
                    }),
                  )
                }
                disabled={busy}
                className="bg-teal-700 text-white"
              >
                Approve Final Quantities
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNTS PAYMENT ENTRY MODAL */}
      {modal === "ACCOUNTS_ENTRY" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Accounts Invoice &amp; Payment Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number *</label>
                <Input value={invNum} onChange={(e) => setInvNum(e.target.value)} placeholder="e.g. INV-2026-99" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date *</label>
                <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Amount (₹) *</label>
                <Input type="number" step="0.01" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Reference Number *</label>
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="e.g. UTR-987654321" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Remarks</label>
                <Input value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} placeholder="Accounts payment notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() =>
                  handleAction(() =>
                    submitAccountsPaymentEntry(dcId, {
                      invoiceNumber: invNum,
                      invoiceDate: invDate,
                      invoiceAmount: Number(invAmount),
                      paymentReferenceNumber: payRef,
                      paymentDate: payDate,
                      paymentRemarks: payRemarks,
                    }),
                  )
                }
                disabled={busy}
                className="bg-blue-800 text-white"
              >
                Save Payment Details
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}