import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { filterDcDataForRole } from "@/server/dcs/sanitizer";
import { DcStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const ROLE_CLOSURE_STATUSES: Record<string, DcStatus[]> = {
  SECURITY: ["DISPATCHED", "AT_VENDOR"],
  STORES: ["SECURITY_RETURNED", "STORE_VERIFIED", "CUSTODIAN_VERIFIED"],
  MANAGEMENT: ["STORE_VERIFIED", "FINAL_APPROVED", "APPROVED_FOR_PAYMENT", "CUSTODIAN_VERIFIED"],
  ACCOUNTS: ["APPROVED_FOR_PAYMENT", "CUSTODIAN_VERIFIED", "CLOSED"],
};

export default async function CloseDcPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const user = await getSessionUser();
  const userRole = user?.roleKeys?.[0] || "GUEST";
  const roleKeys = user?.roleKeys || [];
  const isAdmin = roleKeys.includes("ADMIN");

  // Base closure statuses
  let statusFilter: DcStatus[] = [
    "DISPATCHED",
    "AT_VENDOR",
    "SECURITY_RETURNED",
    "STORE_VERIFIED",
    "CUSTODIAN_VERIFIED",
    "FINAL_APPROVED",
    "APPROVED_FOR_PAYMENT",
    "CLOSED",
  ];

  if (stage === "security") statusFilter = ["DISPATCHED", "AT_VENDOR"];
  else if (stage === "store") statusFilter = ["SECURITY_RETURNED", "CUSTODIAN_VERIFIED"];
  else if (stage === "manager") statusFilter = ["STORE_VERIFIED", "FINAL_APPROVED"];
  else if (stage === "accounts") statusFilter = ["APPROVED_FOR_PAYMENT", "CUSTODIAN_VERIFIED"];
  else if (stage === "closed") statusFilter = ["CLOSED"];
  else statusFilter = ["DISPATCHED", "AT_VENDOR", "SECURITY_RETURNED", "STORE_VERIFIED", "CUSTODIAN_VERIFIED", "FINAL_APPROVED", "APPROVED_FOR_PAYMENT"];

  // Enforce role-based DC filtering for non-admin users
  if (!isAdmin) {
    let allowed: DcStatus[] = [];
    for (const r of roleKeys) {
      if (ROLE_CLOSURE_STATUSES[r]) {
        allowed = [...allowed, ...ROLE_CLOSURE_STATUSES[r]];
      }
    }
    if (allowed.length > 0) {
      const uniqueAllowed = [...new Set(allowed)];
      statusFilter = statusFilter.filter((s) => uniqueAllowed.includes(s));
      if (statusFilter.length === 0) statusFilter = uniqueAllowed;
    }
  }

  const rawDcs = await prisma.deliveryChallan.findMany({
    where: { status: { in: statusFilter } },
    include: {
      vendor: { select: { vendorName: true } },
      process: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Apply server-side blind payload filtering
  const dcs = rawDcs.map((dc) => filterDcDataForRole(dc, userRole));

  function getClosureStageInfo(status: string, invoiceNumber?: string | null, payRef?: string | null) {
    switch (status) {
      case "DISPATCHED":
      case "AT_VENDOR":
        return { stage: "Awaiting Security Return", role: "Security", color: "bg-amber-100 text-amber-900 border-amber-300" };
      case "SECURITY_RETURNED":
        return { stage: "Awaiting Store / Custodian Verification", role: "Stores / Custodian", color: "bg-cyan-100 text-cyan-900 border-cyan-300" };
      case "STORE_VERIFIED":
        return { stage: "Awaiting Quality Inspection", role: "Quality / Manager", color: "bg-teal-100 text-teal-900 border-teal-300" };
      case "CUSTODIAN_VERIFIED":
        return { stage: "Custodian Verified / Ready to Close", role: "Custodian / Admin", color: "bg-sky-100 text-sky-900 border-sky-300" };
      case "FINAL_APPROVED":
        return { stage: "Awaiting Payment Approval", role: "Manager / Admin", color: "bg-emerald-100 text-emerald-900 border-emerald-300" };
      case "APPROVED_FOR_PAYMENT":
        if (invoiceNumber && payRef) {
          return { stage: "Ready to Close", role: "Accounts / Admin", color: "bg-purple-100 text-purple-900 border-purple-300" };
        }
        return { stage: "Awaiting Accounts Entry", role: "Accounts", color: "bg-blue-100 text-blue-900 border-blue-300" };
      case "CLOSED":
        return { stage: "CLOSED", role: "Completed", color: "bg-slate-200 text-slate-800 border-slate-400" };
      default:
        return { stage: status, role: "—", color: "bg-slate-100 text-slate-700 border-slate-300" };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Close DC Workflow Portal</h1>
          <p className="text-xs text-slate-500">
            Process material return, store verification, manager final approval, accounts entry, and explicit closure.
          </p>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Link
          href="/dcs/close"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            !stage ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All Active Closures
        </Link>
        {(isAdmin || roleKeys.includes("SECURITY")) && (
          <Link
            href="/dcs/close?stage=security"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              stage === "security" ? "bg-amber-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Security Gate Return
          </Link>
        )}
        {(isAdmin || roleKeys.includes("STORES")) && (
          <Link
            href="/dcs/close?stage=store"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              stage === "store" ? "bg-cyan-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Store Verification
          </Link>
        )}
        {(isAdmin || roleKeys.includes("MANAGEMENT")) && (
          <Link
            href="/dcs/close?stage=manager"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              stage === "manager" ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Manager Review
          </Link>
        )}
        {(isAdmin || roleKeys.includes("ACCOUNTS")) && (
          <Link
            href="/dcs/close?stage=accounts"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              stage === "accounts" ? "bg-blue-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Accounts Entry
          </Link>
        )}
        {(isAdmin || roleKeys.includes("ACCOUNTS")) && (
          <Link
            href="/dcs/close?stage=closed"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              stage === "closed" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Closed DCs
          </Link>
        )}
      </div>

      {/* TABLE */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">DC Number</th>
              <th className="px-4 py-3">DC Date</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Part Number</th>
              <th className="px-4 py-3">Process</th>
              <th className="px-4 py-3 text-right">RM Qty</th>
              <th className="px-4 py-3 text-right">Exp FG Qty</th>
              <th className="px-4 py-3">Closure Stage</th>
              <th className="px-4 py-3">Responsible Role</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-sans">
            {dcs.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 text-sm">
                  No Delivery Challans found for your role or requested closure stage.
                </td>
              </tr>
            ) : (
              dcs.map((dc) => {
                const info = getClosureStageInfo(dc.status, dc.invoiceNumber, dc.paymentReferenceNumber);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{dc.dcDate.toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-800">{dc.partNumber || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{dc.process?.name || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {dc.rmQuantity != null ? Number(dc.rmQuantity).toFixed(3) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {dc.returnFgQuantity != null ? Number(dc.returnFgQuantity).toFixed(3) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded border px-2.5 py-0.5 text-[11px] font-bold ${info.color}`}>
                        {info.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-700">{info.role}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/dcs/${dc.id}`}
                        className="inline-flex items-center justify-center rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                      >
                        Process Closure
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
