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
import { deleteDraftDc } from "@/server/dcs/extended-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DcActions({
  dcId,
  status,
  userRole,
  permissions,
  closeEligibility,
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
  closeEligibility?: {
    eligible: boolean;
    missingFields: string[];
  };
  dcData: {
    dcNumber?: string;
    rmQuantity?: number | null;
    returnFgQuantity?: number | null;
    actualInwardQty?: number | null;
    storeReceivedQty?: number | null;
    goodQty?: number | null;
    rejectionQty?: number | null;
    scrapQty?: number | null;
    ratePerQuantity?: number | null;
    pricingBasis?: string | null;
    securityDispatchQuantity?: number | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    invoiceAmount?: number | null;
    paymentReferenceNumber?: string | null;
    paymentDate?: string | null;
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
    | "DELETE_DRAFT"
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

  // Security Inward / Return (Security records ONLY physical material received)
  const [secActualInwardQty, setSecActualInwardQty] = useState(String(dcData.actualInwardQty || dcData.returnFgQuantity || ""));
  const [secInwardDate, setSecInwardDate] = useState(new Date().toISOString().split("T")[0]);
  const [secDocNo, setSecDocNo] = useState("");
  const [secInvoiceNo, setSecInvoiceNo] = useState(dcData.invoiceNumber || "");
  const [secVehicle, setSecVehicle] = useState("");
  const [secRemarks, setSecRemarks] = useState("");

  // Store Verification (Store records storeReceivedQty and store weights)
  const [storeReceivedQtyInput, setStoreReceivedQtyInput] = useState(String(dcData.storeReceivedQty || dcData.actualInwardQty || dcData.returnFgQuantity || ""));
  const [storeReceivedDate, setStoreReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [storeGatingWeight, setStoreGatingWeight] = useState("");
  const [storeBoringWeight, setStoreBoringWeight] = useState("");
  const [storeRemarks, setStoreRemarks] = useState("");

  // Manager Payment Approval (Quality results are read-only)
  const [managerRemarks, setManagerRemarks] = useState("");

  // Accounts Payment Entry
  const [invNum, setInvNum] = useState(dcData.invoiceNumber || "");
  const [invDate, setInvDate] = useState(dcData.invoiceDate || new Date().toISOString().split("T")[0]);
  const [invAmount, setInvAmount] = useState(dcData.invoiceAmount ? String(dcData.invoiceAmount) : "");
  const [payRef, setPayRef] = useState(dcData.paymentReferenceNumber || "");
  const [payDate, setPayDate] = useState(dcData.paymentDate || new Date().toISOString().split("T")[0]);
  const [payRemarks, setPayRemarks] = useState("");
  const [accountsFieldErrors, setAccountsFieldErrors] = useState<Record<string, string>>({});
  const [accountsSuccessMsg, setAccountsSuccessMsg] = useState<string | null>(null);

  // Authoritative Readiness logic for CLOSE DC action
  const isReadyToClose = closeEligibility
    ? closeEligibility.eligible
    : status === "APPROVED_FOR_PAYMENT" &&
      !!(dcData.invoiceNumber || invNum)?.trim() &&
      !!(dcData.invoiceDate || invDate) &&
      Number(dcData.invoiceAmount ?? invAmount ?? 0) > 0 &&
      !!(dcData.paymentReferenceNumber || payRef)?.trim() &&
      !!(dcData.paymentDate || payDate);

  const missingFeedback = closeEligibility && closeEligibility.missingFields.length > 0
    ? closeEligibility.missingFields.join(", ")
    : "Complete required Invoice and Payment details";

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
        {/* 1. DRAFT or SENT_BACK -> PENDING_APPROVAL / EDIT / DELETE */}
        {(status === "DRAFT" || status === "SENT_BACK") && permissions.canSubmit && (
          <>
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => router.push(`/dcs/${dcId}/edit`)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Edit DC
            </Button>
            <Button
              disabled={busy}
              variant="danger"
              onClick={() => setModal("DELETE_DRAFT")}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              Delete Draft
            </Button>
            <Button disabled={busy} onClick={() => handleAction(() => submitForApproval(dcId))} className="bg-blue-600 text-white hover:bg-blue-700">
              Submit for Approval
            </Button>
          </>
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

        {/* 7 & 8. QUALITY_COMPLETED / FINAL_APPROVED -> APPROVED_FOR_PAYMENT */}
        {(status === "QUALITY_COMPLETED" || status === "FINAL_APPROVED" || status === "STORE_VERIFIED") && permissions.canPaymentApprove && (
          <Button disabled={busy} onClick={() => setModal("FINAL_APPROVE")} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            Manager Payment Approval
          </Button>
        )}

        {/* 9. APPROVED_FOR_PAYMENT -> ACCOUNTS ENTRY & CLOSE */}
        {status === "APPROVED_FOR_PAYMENT" && (
          <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              {permissions.canAccountsEntry && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setAccountsFieldErrors({});
                    setAccountsSuccessMsg(null);
                    setModal("ACCOUNTS_ENTRY");
                  }}
                  className="bg-blue-800 hover:bg-blue-900 text-white font-semibold shadow-sm"
                >
                  Enter Invoice &amp; Payment Details
                </Button>
              )}

              {permissions.canClose && (
                isReadyToClose ? (
                  <Button
                    disabled={busy}
                    onClick={() => handleAction(() => closeDc(dcId))}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md px-5 py-2"
                  >
                    CLOSE DC
                  </Button>
                ) : (
                  <Button
                    disabled={true}
                    title={`Cannot close DC. Requirements: ${missingFeedback}`}
                    className="bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed font-bold opacity-70 px-5 py-2"
                  >
                    CLOSE DC
                  </Button>
                )
              )}
            </div>

            {permissions.canClose && (
              <div className="text-xs font-medium">
                {isReadyToClose ? (
                  <span className="text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md flex items-center gap-1.5">
                    ✓ Payment details saved — DC is ready to be closed.
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md flex items-center gap-1.5">
                    ⚠ Complete requirements to enable CLOSE DC: {missingFeedback}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {status === "CLOSED" && (
          <div className="w-full p-3 bg-slate-100 border border-slate-300 text-slate-800 rounded-md text-xs font-semibold flex items-center justify-between">
            <span>🔒 DC is CLOSED. All operational, commercial, and financial entries are locked and read-only.</span>
            <span className="text-[10px] text-slate-500 font-mono uppercase">Completed &amp; Archival Mode</span>
          </div>
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
            <p className="text-xs text-slate-500">Record physical material received at the security gate.</p>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Inward Qty (NOS) *</label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={secActualInwardQty}
                  onChange={(e) => setSecActualInwardQty(e.target.value)}
                  placeholder="Actual inward quantity received"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inward Date *</label>
                <Input type="date" value={secInwardDate} onChange={(e) => setSecInwardDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inward Document Number</label>
                <Input value={secDocNo} onChange={(e) => setSecDocNo(e.target.value)} placeholder="Gate inward pass no." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Invoice Number</label>
                <Input value={secInvoiceNo} onChange={(e) => setSecInvoiceNo(e.target.value)} placeholder="e.g. INV-12345" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Number</label>
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
                      actualInwardQty: Number(secActualInwardQty),
                      inwardDate: secInwardDate,
                      inwardDocumentNo: secDocNo,
                      invoiceNumber: secInvoiceNo,
                      vehicleNumber: secVehicle,
                      remarks: secRemarks,
                    }),
                  )
                }
                disabled={busy || !secActualInwardQty || Number(secActualInwardQty) <= 0}
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
            <h3 className="text-base font-bold text-slate-900">Store Receipt Confirmation</h3>
            <p className="text-xs text-slate-500">Confirm physical material receipt into store inventory.</p>

            <div className="rounded-md bg-slate-50 p-3 border border-slate-200 text-xs">
              <span className="text-slate-500 block">Security Actual Inward Qty</span>
              <span className="font-bold text-blue-900 text-sm">{dcData.actualInwardQty ?? 0} NOS</span>
            </div>

            {Number(storeReceivedQtyInput) !== (dcData.actualInwardQty ?? 0) && Number(storeReceivedQtyInput) > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs font-medium">
                ⚠ Store Received Qty ({storeReceivedQtyInput}) differs from Security Actual Inward Qty ({dcData.actualInwardQty ?? 0}). Variance will be recorded.
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Received Quantity (NOS) *</label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={storeReceivedQtyInput}
                  onChange={(e) => setStoreReceivedQtyInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Receipt Date *</label>
                <Input
                  type="date"
                  value={storeReceivedDate}
                  onChange={(e) => setStoreReceivedDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Gating Weight (KG)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={storeGatingWeight}
                  onChange={(e) => setStoreGatingWeight(e.target.value)}
                  placeholder="0.000 (KG)"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Boring Weight (KG)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={storeBoringWeight}
                  onChange={(e) => setStoreBoringWeight(e.target.value)}
                  placeholder="0.000 (KG)"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Remarks</label>
                <Input value={storeRemarks} onChange={(e) => setStoreRemarks(e.target.value)} placeholder="Store location or verification notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() =>
                  handleAction(() =>
                    submitStoreVerification(dcId, {
                      storeReceivedQty: Number(storeReceivedQtyInput),
                      storeReceivedDate: storeReceivedDate,
                      storeGatingWeight: storeGatingWeight ? Number(storeGatingWeight) : undefined,
                      storeBoringWeight: storeBoringWeight ? Number(storeBoringWeight) : undefined,
                      storeRemarks,
                    }),
                  )
                }
                disabled={busy || !storeReceivedQtyInput || Number(storeReceivedQtyInput) <= 0}
                className="bg-cyan-700 text-white"
              >
                Submit Store Verification
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGER PAYMENT APPROVAL MODAL */}
      {modal === "FINAL_APPROVE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Manager Payment Approval</h3>
            <p className="text-xs text-slate-500">Review Quality inspection results and approve DC for payment processing.</p>

            <div className="rounded-md bg-slate-50 p-4 border border-slate-200 space-y-3 text-xs">
              <div className="font-semibold text-slate-700 uppercase tracking-wide text-[11px] border-b border-slate-200 pb-1">
                Quality Inspection Results (Read-Only)
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-slate-500 text-[10px] block font-semibold">GOOD QTY</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{dcData.goodQty ?? 0} NOS</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-slate-500 text-[10px] block font-semibold">REJECTION QTY</span>
                  <span className="font-mono font-bold text-red-700 text-sm">{dcData.rejectionQty ?? 0} NOS</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-slate-500 text-[10px] block font-semibold">SCRAP QTY</span>
                  <span className="font-mono font-bold text-amber-700 text-sm">{dcData.scrapQty ?? 0} NOS</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-sans">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Pricing Basis / Rate</span>
                  <span className="font-semibold text-slate-800">{dcData.pricingBasis || "FG"} Basis @ ₹{dcData.ratePerQuantity ?? 0}/unit</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Auto-Calculated Final Payable</span>
                  <span className="font-mono font-bold text-emerald-800 text-base">
                    ₹{((dcData.pricingBasis === "RM" ? (dcData.rmQuantity ?? 0) : (dcData.goodQty ?? 0)) * (dcData.ratePerQuantity ?? 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() => handleAction(() => submitPaymentApproval(dcId))}
                disabled={busy}
                className="bg-emerald-700 text-white font-bold"
              >
                Confirm Payment Approval
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNTS PAYMENT ENTRY MODAL */}
      {modal === "ACCOUNTS_ENTRY" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-900">Accounts Invoice &amp; Payment Details</h3>
              <span className="text-xs text-red-600 font-semibold">* Required fields</span>
            </div>

            {accountsSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-semibold">
                {accountsSuccessMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Number <span className="text-red-600 font-bold">*</span>
                </label>
                <Input
                  value={invNum}
                  onChange={(e) => {
                    setInvNum(e.target.value);
                    if (accountsFieldErrors.invoiceNumber) {
                      setAccountsFieldErrors((prev) => ({ ...prev, invoiceNumber: "" }));
                    }
                  }}
                  placeholder="e.g. INV-2026-99"
                  className={accountsFieldErrors.invoiceNumber ? "border-red-500 bg-red-50/20" : ""}
                />
                {accountsFieldErrors.invoiceNumber && (
                  <p className="text-red-600 text-xs font-semibold mt-1">{accountsFieldErrors.invoiceNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Date <span className="text-red-600 font-bold">*</span>
                </label>
                <Input
                  type="date"
                  value={invDate}
                  onChange={(e) => {
                    setInvDate(e.target.value);
                    if (accountsFieldErrors.invoiceDate) {
                      setAccountsFieldErrors((prev) => ({ ...prev, invoiceDate: "" }));
                    }
                  }}
                  className={accountsFieldErrors.invoiceDate ? "border-red-500 bg-red-50/20" : ""}
                />
                {accountsFieldErrors.invoiceDate && (
                  <p className="text-red-600 text-xs font-semibold mt-1">{accountsFieldErrors.invoiceDate}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Amount (₹) <span className="text-red-600 font-bold">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={invAmount}
                  onChange={(e) => {
                    setInvAmount(e.target.value);
                    if (accountsFieldErrors.invoiceAmount) {
                      setAccountsFieldErrors((prev) => ({ ...prev, invoiceAmount: "" }));
                    }
                  }}
                  placeholder="Must be greater than 0"
                  className={accountsFieldErrors.invoiceAmount ? "border-red-500 bg-red-50/20" : ""}
                />
                {accountsFieldErrors.invoiceAmount && (
                  <p className="text-red-600 text-xs font-semibold mt-1">{accountsFieldErrors.invoiceAmount}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Reference Number <span className="text-red-600 font-bold">*</span>
                </label>
                <Input
                  value={payRef}
                  onChange={(e) => {
                    setPayRef(e.target.value);
                    if (accountsFieldErrors.paymentReferenceNumber) {
                      setAccountsFieldErrors((prev) => ({ ...prev, paymentReferenceNumber: "" }));
                    }
                  }}
                  placeholder="e.g. UTR-987654321"
                  className={accountsFieldErrors.paymentReferenceNumber ? "border-red-500 bg-red-50/20" : ""}
                />
                {accountsFieldErrors.paymentReferenceNumber && (
                  <p className="text-red-600 text-xs font-semibold mt-1">{accountsFieldErrors.paymentReferenceNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Date <span className="text-red-600 font-bold">*</span>
                </label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => {
                    setPayDate(e.target.value);
                    if (accountsFieldErrors.paymentDate) {
                      setAccountsFieldErrors((prev) => ({ ...prev, paymentDate: "" }));
                    }
                  }}
                  className={accountsFieldErrors.paymentDate ? "border-red-500 bg-red-50/20" : ""}
                />
                {accountsFieldErrors.paymentDate && (
                  <p className="text-red-600 text-xs font-semibold mt-1">{accountsFieldErrors.paymentDate}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Remarks</label>
                <Input value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} placeholder="Accounts payment notes (Optional)" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
              <Button
                onClick={() => {
                  const errors: Record<string, string> = {};
                  if (!invNum.trim()) errors.invoiceNumber = "Invoice Number is required";
                  if (!invDate) errors.invoiceDate = "Invoice Date is required";
                  if (!invAmount || Number(invAmount) <= 0) errors.invoiceAmount = "Invoice Amount must be greater than 0";
                  if (!payRef.trim()) errors.paymentReferenceNumber = "Payment Reference Number is required";
                  if (!payDate) errors.paymentDate = "Payment Date is required";

                  setAccountsFieldErrors(errors);
                  if (Object.keys(errors).length > 0) return;

                  handleAction(async () => {
                    const res = await submitAccountsPaymentEntry(dcId, {
                      invoiceNumber: invNum,
                      invoiceDate: invDate,
                      invoiceAmount: Number(invAmount),
                      paymentReferenceNumber: payRef,
                      paymentDate: payDate,
                      paymentRemarks: payRemarks,
                    });
                    if (res.ok) {
                      setAccountsSuccessMsg("✓ Invoice and Payment details saved successfully.");
                    }
                    return res;
                  });
                }}
                disabled={busy}
                className="bg-blue-800 hover:bg-blue-900 text-white font-semibold"
              >
                Save Payment Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE DRAFT CONFIRMATION MODAL */}
      {modal === "DELETE_DRAFT" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-red-700 border-b pb-2">Delete Draft DC?</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                DC Number: <span className="font-mono">{dcData.dcNumber || dcId}</span>
              </p>
              <p className="text-slate-600 bg-red-50 border border-red-200 p-3 rounded-md text-xs font-medium">
                This action will permanently delete this Draft DC and cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" disabled={busy} onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const res = await deleteDraftDc(dcId);
                  setBusy(false);
                  if (!res.ok) {
                    setError(res.error || "Failed to delete Draft DC.");
                    setModal(null);
                  } else {
                    setModal(null);
                    router.push("/dcs");
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {busy ? "Deleting Draft..." : "Delete Draft"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}