"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ALLOWED_DEPARTMENTS } from "@/lib/validation/registration";
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
} from "@/server/registration/actions";

interface RequestItem {
  id: string;
  fullName: string;
  email: string;
  employeeId: string | null;
  phone: string | null;
  requestedDepartment: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  rejectionReason: string | null;
  createdAt: Date;
}

interface RoleItem {
  key: string;
  name: string;
}

export function RequestTable({
  requests,
  roles,
}: {
  requests: RequestItem[];
  roles: RoleItem[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  const [approveModalReq, setApproveModalReq] = useState<RequestItem | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>("Production");
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("STORES");
  const [approvingPersonName, setApprovingPersonName] = useState<string>("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [activationResult, setActivationResult] = useState<{
    token: string;
    url: string;
    userName: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [rejectModalReq, setRejectModalReq] = useState<RequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === "ALL") return true;
    return r.status === statusFilter;
  });

  const availableRoles = roles.filter((r) => r.key !== "VENDOR");

  function openApproveModal(req: RequestItem) {
    setApproveModalReq(req);
    setSelectedDept(req.requestedDepartment || "Production");
    setSelectedRoleKey(availableRoles.find((r) => r.key === "STORES")?.key || availableRoles[0]?.key || "STORES");
    setApprovingPersonName("");
    setApproveError(null);
  }

  async function handleApprove() {
    if (!approveModalReq) return;

    setApproving(true);
    setApproveError(null);

    try {
      const res = await approveRegistrationRequest({
        requestId: approveModalReq.id,
        department: selectedDept as any,
        roleKey: selectedRoleKey,
        approvingPersonName: approvingPersonName.trim() || undefined,
      });

      if (!res.ok) {
        setApproveError(res.error);
      } else {
        const fullUrl = `${window.location.origin}${res.activationUrl}`;
        setActivationResult({
          token: res.activationToken,
          url: fullUrl,
          userName: approveModalReq.fullName,
        });
        setApproveModalReq(null);
      }
    } catch {
      setApproveError("Failed to approve registration request.");
    } finally {
      setApproving(false);
    }
  }

  function openRejectModal(req: RequestItem) {
    setRejectModalReq(req);
    setRejectionReason("");
    setRejectError(null);
  }

  async function handleReject() {
    if (!rejectModalReq) return;

    setRejecting(true);
    setRejectError(null);

    try {
      const res = await rejectRegistrationRequest({
        requestId: rejectModalReq.id,
        rejectionReason: rejectionReason.trim(),
      });

      if (!res.ok) {
        setRejectError(res.error);
      } else {
        setRejectModalReq(null);
      }
    } catch {
      setRejectError("Failed to reject registration request.");
    } finally {
      setRejecting(false);
    }
  }

  function handleCopyUrl() {
    if (activationResult?.url) {
      navigator.clipboard.writeText(activationResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setStatusFilter("PENDING")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            statusFilter === "PENDING"
              ? "bg-amber-100 text-amber-800"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Pending Review ({requests.filter((r) => r.status === "PENDING").length})
        </button>
        <button
          onClick={() => setStatusFilter("APPROVED")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            statusFilter === "APPROVED"
              ? "bg-emerald-100 text-emerald-800"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Approved ({requests.filter((r) => r.status === "APPROVED").length})
        </button>
        <button
          onClick={() => setStatusFilter("REJECTED")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            statusFilter === "REJECTED"
              ? "bg-red-100 text-red-800"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Rejected ({requests.filter((r) => r.status === "REJECTED").length})
        </button>
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            statusFilter === "ALL"
              ? "bg-slate-800 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Requests ({requests.length})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Applicant</th>
              <th className="px-3 py-2.5 font-medium">Emp ID / Phone</th>
              <th className="px-3 py-2.5 font-medium">Requested Dept</th>
              <th className="px-3 py-2.5 font-medium">Reason / Purpose</th>
              <th className="px-3 py-2.5 font-medium">Date Requested</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No registration requests found in this view.
                </td>
              </tr>
            ) : (
              filteredRequests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900">{r.fullName}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    <div>{r.employeeId ? `ID: ${r.employeeId}` : "—"}</div>
                    <div className="text-slate-400">{r.phone || ""}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                      {r.requestedDepartment}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 max-w-xs truncate">
                    {r.reason || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                    {r.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </span>
                    )}
                    {r.status === "REJECTED" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800" title={r.rejectionReason || undefined}>
                        <XCircle className="h-3 w-3" /> Rejected
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {r.status === "PENDING" ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => openApproveModal(r)}
                          className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-3"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openRejectModal(r)}
                          className="h-8 border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium px-3"
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* APPROVE DIALOG */}
      {approveModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Approve User Account
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Approving registration for <span className="font-semibold text-slate-800">{approveModalReq.fullName}</span> ({approveModalReq.email}).
              </p>
            </div>

            <div className="space-y-4">
              {/* Department Assignment */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Assign Department
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  {ALLOWED_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  Requested: {approveModalReq.requestedDepartment}
                </p>
              </div>

              {/* Role Assignment */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Assign Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRoleKey}
                  onChange={(e) => setSelectedRoleKey(e.target.value)}
                  className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
                >
                  {availableRoles.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.key} &mdash; {role.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  User self-registration never assigns a role. Admin must assign the initial role.
                </p>
              </div>

              {/* Approving Person's Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Approving Person&apos;s Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter name of person approving this account..."
                  value={approvingPersonName}
                  onChange={(e) => setApprovingPersonName(e.target.value)}
                  className="h-10 text-sm border-slate-300"
                />
                <p className="text-xs text-slate-500">
                  Optional: Name of manager/approver authorizing this account creation.
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
                onClick={() => setApproveModalReq(null)}
                disabled={approving}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="h-9 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
              >
                {approving ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Approving...
                  </span>
                ) : (
                  "Confirm & Approve Account"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVATION LINK SUCCESS MODAL */}
      {activationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">
                Account Approved &amp; Created
              </h3>
            </div>

            <p className="text-sm text-slate-600">
              Account created for <span className="font-semibold text-slate-900">{activationResult.userName}</span> in inactive state.
            </p>

            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                Email Delivery Status Notice
              </div>
              <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200 font-medium">
                Email delivery is not configured. Copy this secure activation link for the user:
              </p>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">
                  One-Time Activation URL
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={activationResult.url}
                    className="h-9 text-xs bg-white border-slate-300 font-mono"
                  />
                  <Button
                    type="button"
                    onClick={handleCopyUrl}
                    className="h-9 bg-slate-900 hover:bg-slate-800 text-white text-xs px-3"
                  >
                    {copied ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Copied!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="h-3.5 w-3.5" /> Copy Link
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              This activation token is single-use and will expire in 24 hours. The user must use it to set their initial private password.
            </p>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <Button
                type="button"
                onClick={() => setActivationResult(null)}
                className="h-9 bg-slate-900 hover:bg-slate-800 text-white text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT DIALOG */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 text-red-700 flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Reject Registration Request
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Rejecting request for <span className="font-semibold text-slate-800">{rejectModalReq.fullName}</span> ({rejectModalReq.email}).
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Rejection Reason <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejecting this request..."
                  className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
                />
              </div>

              {rejectError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">
                  {rejectError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRejectModalReq(null)}
                disabled={rejecting}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReject}
                disabled={rejecting}
                className="h-9 bg-red-700 hover:bg-red-800 text-white text-xs font-medium"
              >
                {rejecting ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rejecting...
                  </span>
                ) : (
                  "Reject Request"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
