import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ManagementDashboardPage() {
  const [pendingApproval, finalApprovalQueue, paymentApprovalQueue] = await Promise.all([
    prisma.deliveryChallan.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: { vendor: true, process: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deliveryChallan.findMany({
      where: { status: "STORE_VERIFIED" },
      include: { vendor: true, process: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deliveryChallan.findMany({
      where: { status: "FINAL_APPROVED" },
      include: { vendor: true, process: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Management Approval &amp; Review Portal</h1>
        <p className="text-xs text-slate-500">
          Review DC approvals, compare Security vs Store quantities, approve final quantities, and grant payment authorization.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">1. Pending Approvals</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-950">{pendingApproval.length}</p>
          <p className="mt-1 text-[11px] text-amber-700">Status: PENDING_APPROVAL</p>
        </div>

        <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">2. Final Approvals Required</p>
          <p className="mt-2 text-3xl font-extrabold text-teal-950">{finalApprovalQueue.length}</p>
          <p className="mt-1 text-[11px] text-teal-700">Status: STORE_VERIFIED</p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">3. Payment Approvals Required</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-950">{paymentApprovalQueue.length}</p>
          <p className="mt-1 text-[11px] text-emerald-700">Status: FINAL_APPROVED</p>
        </div>
      </div>

      {/* Queue 1: Final Approval Queue (Side-by-Side Comparison) */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-teal-900 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider">Final Approval Queue (Manager Comparison)</h2>
          <span className="rounded bg-teal-800 px-2 py-0.5 text-xs font-semibold">{finalApprovalQueue.length} Pending</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">DC Number</th>
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Part Number</th>
              <th className="px-4 py-2.5 text-right">Sec FG Qty</th>
              <th className="px-4 py-2.5 text-right">Store FG Qty</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {finalApprovalQueue.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 italic">No DCs awaiting final manager approval.</td>
              </tr>
            ) : (
              finalApprovalQueue.map((dc) => (
                <tr key={dc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{dc.partNumber || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {dc.securityFgQuantity != null ? Number(dc.securityFgQuantity).toFixed(3) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {dc.storeVerifiedFgQuantity != null ? Number(dc.storeVerifiedFgQuantity).toFixed(3) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/dcs/${dc.id}`}
                      className="inline-block rounded bg-teal-700 px-3 py-1 text-xs font-bold text-white hover:bg-teal-800"
                    >
                      Compare &amp; Final Approve
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
