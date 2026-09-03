import Link from "next/link";
import { getSessionUser } from "@/server/session";
import { getSecurityDispatchQueue, getSecurityReturnQueue, getSecurityCompletedQueue } from "@/server/dcs/queries";
import { SecurityInwardForm } from "../security-inward-form";

export const dynamic = "force-dynamic";

export default async function SecurityDashboardPage() {
  const user = await getSessionUser();
  const userRole = user?.roleKeys?.[0] || "SECURITY";

  const [waitingDispatch, waitingReturn, recentSecurity] = await Promise.all([
    getSecurityDispatchQueue(userRole),
    getSecurityReturnQueue(userRole),
    getSecurityCompletedQueue(userRole),
  ]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Security DC Operations Portal</h1>
        <p className="text-xs text-slate-500">
          Manage gate dispatch verification and security return entries for all factory delivery challans.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">1. Waiting for Dispatch</p>
          <p className="mt-2 text-3xl font-extrabold text-indigo-950">{waitingDispatch.length}</p>
          <p className="mt-1 text-[11px] text-indigo-600">Status: APPROVED — Ready at gate</p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">2. Waiting for Material Return</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-950">{waitingReturn.length}</p>
          <p className="mt-1 text-[11px] text-amber-600">Status: DISPATCHED / AT_VENDOR</p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">3. Security Returned</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-950">{recentSecurity.length}</p>
          <p className="mt-1 text-[11px] text-emerald-600">Status: SECURITY_RETURNED</p>
        </div>
      </div>

      {/* Queue 1: Waiting for Dispatch */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-indigo-900 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider">Queue 1: Waiting for Gate Dispatch</h2>
          <span className="rounded bg-indigo-800 px-2 py-0.5 text-xs font-semibold">{waitingDispatch.length} Pending</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">DC Number</th>
              <th className="px-4 py-2.5">DC Date</th>
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Part Number</th>
              <th className="px-4 py-2.5 text-right">RM Qty (Sent)</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {waitingDispatch.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 italic">No DCs currently waiting for dispatch.</td>
              </tr>
            ) : (
              waitingDispatch.map((dc) => (
                <tr key={dc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{dc.dcDate.toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{dc.partNumber || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {dc.rmQuantity != null ? Number(dc.rmQuantity).toFixed(3) : "—"} kg
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/dcs/${dc.id}`}
                      className="inline-block rounded bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700"
                    >
                      Enter Dispatch
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Queue 2: Waiting for Return Entry */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-amber-800 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider">Queue 2: Waiting for Security Return Entry</h2>
          <span className="rounded bg-amber-700 px-2 py-0.5 text-xs font-semibold">{waitingReturn.length} Pending</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">DC Number</th>
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Part Number</th>
              <th className="px-4 py-2.5 text-right">Sent RM Qty</th>
              <th className="px-4 py-2.5 text-right">Expected FG Qty</th>
              <th className="px-4 py-2.5">Current Status</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {waitingReturn.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400 italic">No dispatched DCs awaiting return entry.</td>
              </tr>
            ) : (
              waitingReturn.map((dc) => (
                <tr key={dc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{dc.partNumber || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {dc.rmQuantity != null ? Number(dc.rmQuantity).toFixed(3) : "—"} kg
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {dc.returnFgQuantity != null ? Number(dc.returnFgQuantity).toFixed(3) : "—"} kg
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 border border-amber-300">
                      {dc.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <SecurityInwardForm
                      dc={{
                        id: dc.id,
                        dcNumber: dc.dcNumber,
                        partNumber: dc.partNumber,
                        rmQuantity: dc.rmQuantity != null ? Number(dc.rmQuantity) : null,
                        returnFgQuantity: dc.returnFgQuantity != null ? Number(dc.returnFgQuantity) : null,
                        vendorName: dc.vendor?.vendorName,
                      }}
                    />
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
