import { getSessionUser } from "@/server/session";
import { getSecurityCompletedQueue } from "@/server/dcs/queries";

export const dynamic = "force-dynamic";

export default async function SecurityMyEntriesPage() {
  const user = await getSessionUser();
  const userRole = user?.roleKeys?.[0] || "SECURITY";

  const dcs = await getSecurityCompletedQueue(userRole);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">My Security Gate Return Entries</h1>
        <p className="text-xs text-slate-500">
          History of material return gate entries recorded by Security.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-emerald-900 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider">Completed Security Inward Entries (SECURITY_RETURNED)</h2>
          <span className="rounded bg-emerald-800 px-2 py-0.5 text-xs font-semibold">{dcs.length} Entries</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">DC Number</th>
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Part Number</th>
              <th className="px-4 py-2.5 text-right">Sec FG Qty</th>
              <th className="px-4 py-2.5 text-right">Sec Rejection</th>
              <th className="px-4 py-2.5 text-right">Sec Scrap</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {dcs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 italic text-sm">
                  No completed Security gate return entries recorded yet.
                </td>
              </tr>
            ) : (
              dcs.map((dc) => (
                <tr key={dc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName || "—"}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{dc.partNumber || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-900">
                    {dc.securityFgQuantity != null ? Number(dc.securityFgQuantity).toFixed(3) : "—"} kg
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">
                    {dc.securityRejectionQuantity != null ? Number(dc.securityRejectionQuantity).toFixed(3) : "—"} kg
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">
                    {dc.securityScrapQuantity != null ? Number(dc.securityScrapQuantity).toFixed(3) : "—"} kg
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900 border border-emerald-300">
                      {dc.status.replace(/_/g, " ")}
                    </span>
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
