import { getSessionUser } from "@/server/session";
import { getSecurityReturnQueue } from "@/server/dcs/queries";
import { SecurityInwardForm } from "../security-inward-form";

export const dynamic = "force-dynamic";

export default async function SecurityMaterialInwardPage() {
  const user = await getSessionUser();
  const userRole = user?.roleKeys?.[0] || "SECURITY";

  const dcs = await getSecurityReturnQueue(userRole);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Material Inward / Gate Return Module</h1>
        <p className="text-xs text-slate-500">
          Standalone operational queue for Security personnel to record factory gate material inward entries.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-amber-900 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider">Material Inward Pending Queue (DISPATCHED / AT_VENDOR)</h2>
          <span className="rounded bg-amber-800 px-2 py-0.5 text-xs font-semibold">{dcs.length} Eligible</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">DC Number</th>
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Part Number</th>
              <th className="px-4 py-2.5 text-right">RM Qty Sent</th>
              <th className="px-4 py-2.5 text-right">Exp FG Qty</th>
              <th className="px-4 py-2.5">Current Status</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {dcs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 italic text-sm">
                  No Delivery Challans currently waiting for Security Material Inward return entry.
                </td>
              </tr>
            ) : (
              dcs.map((dc) => (
                <tr key={dc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName || "—"}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{dc.partNumber || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {dc.rmQuantity != null ? Number(dc.rmQuantity).toFixed(3) : "—"} kg
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {dc.returnFgQuantity != null ? Number(dc.returnFgQuantity).toFixed(3) : "—"} kg
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
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
