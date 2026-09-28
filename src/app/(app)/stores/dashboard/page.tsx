import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { filterDcDataForRole } from "@/server/dcs/sanitizer";

export const dynamic = "force-dynamic";

export default async function StoreDashboardPage() {
  const user = await getSessionUser();
  const userRole = user?.roleKeys?.[0] || "STORES";

  const [storeVerifyQueueRaw, pendingApprovalRaw, draftDcsRaw] = await Promise.all([
    prisma.deliveryChallan.findMany({
      where: { status: "SECURITY_RETURNED" },
      include: { vendor: true, process: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deliveryChallan.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: { vendor: true, process: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deliveryChallan.findMany({
      where: { status: "DRAFT" },
      include: { vendor: true, process: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const storeVerifyQueue = storeVerifyQueueRaw.map((dc) => filterDcDataForRole(dc, userRole));
  const pendingApproval = pendingApprovalRaw.map((dc) => filterDcDataForRole(dc, userRole));
  const draftDcs = draftDcsRaw.map((dc) => filterDcDataForRole(dc, userRole));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Store DC Operations Portal</h1>
          <p className="text-xs text-slate-500">
            Create DCs, verify material returns independently, and manage inventory receipts.
          </p>
        </div>
        <Link
          href="/dcs/new"
          className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 shadow-sm"
        >
          + Create New Delivery Challan
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">1. Store Verification Queue</p>
          <p className="mt-2 text-3xl font-extrabold text-cyan-950">{storeVerifyQueue.length}</p>
          <p className="mt-1 text-[11px] text-cyan-700">Status: SECURITY_RETURNED</p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">2. Pending Approval</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-950">{pendingApproval.length}</p>
          <p className="mt-1 text-[11px] text-amber-700">Status: PENDING_APPROVAL</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">3. Draft DCs</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{draftDcs.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">Status: DRAFT</p>
        </div>
      </div>

      {/* Queue 1: Store Verification Queue */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-cyan-900 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider">Store Material Verification Queue</h2>
          <span className="rounded bg-cyan-800 px-2 py-0.5 text-xs font-semibold">{storeVerifyQueue.length} Pending</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">DC Number</th>
              <th className="px-4 py-2.5">DC Date</th>
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Part Number</th>
              <th className="px-4 py-2.5 text-right">Expected FG Qty</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {storeVerifyQueue.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 italic">No returned DCs awaiting store verification.</td>
              </tr>
            ) : (
              storeVerifyQueue.map((dc) => (
                <tr key={dc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{dc.dcDate.toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{dc.partNumber || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {dc.returnFgQuantity != null ? Number(dc.returnFgQuantity).toFixed(3) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/dcs/${dc.id}`}
                      className="inline-block rounded bg-cyan-700 px-3 py-1 text-xs font-bold text-white hover:bg-cyan-800"
                    >
                      Store Verify
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
