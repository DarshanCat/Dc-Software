import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getVendorOutstandingRows } from "@/server/reports/vendor-outstanding";

export default async function VendorOutstandingReportPage() {
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.REPORT_VIEW) : false;
  const canExport = user ? await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT) : false;

  if (!canView) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to view reports.
      </div>
    );
  }

  const rows = await getVendorOutstandingRows();
  const sorted = [...rows].sort((a, b) => b.materialOutsideKg - a.materialOutsideKg);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Vendor Outstanding</h1>
          <p className="text-sm text-slate-500">{rows.length} active vendor(s)</p>
        </div>
        {canExport && (
          <a href="/reports/vendor-outstanding/export" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Export CSV</a>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 text-right font-medium">Open DCs</th>
              <th className="px-3 py-2 text-right font-medium">Material Outside</th>
              <th className="px-3 py-2 text-right font-medium">Finished Pending</th>
              <th className="px-3 py-2 text-right font-medium">Scrap Pending</th>
              <th className="px-3 py-2 text-right font-medium">Overdue DCs</th>
              <th className="px-3 py-2 text-right font-medium">Avg Return Days</th>
              <th className="px-3 py-2 text-right font-medium">Scrap Recovery %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  No active vendors.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.vendorId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{r.vendorName}</div>
                    <div className="font-mono text-xs text-slate-400">{r.vendorCode}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.openDcCount}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.materialOutsideKg.toFixed(3)} kg</td>
                  <td className="px-3 py-2 text-right font-mono">{r.finishedPendingKg.toFixed(3)} kg</td>
                  <td className="px-3 py-2 text-right font-mono">{r.scrapPendingKg.toFixed(3)} kg</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.overdueDcCount > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{r.overdueDcCount}</span>
                    ) : (
                      r.overdueDcCount
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.avgReturnDays === null ? "—" : r.avgReturnDays.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.scrapRecoveryPercent === null ? "N/A" : r.scrapRecoveryPercent.toFixed(1) + "%"}
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