import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getVendorPerformanceRows, parseWeight } from "@/server/reports/vendor-performance";

export const dynamic = "force-dynamic";

interface SearchParams {
  wReturn?: string;
  wRecon?: string;
  wScrap?: string;
  wQuality?: string;
}

export default async function VendorPerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.REPORT_VIEW) : false;

  if (!canView) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to view reports.
      </div>
    );
  }

  const wReturn = parseWeight(sp.wReturn, 25);
  const wRecon = parseWeight(sp.wRecon, 25);
  const wScrap = parseWeight(sp.wScrap, 25);
  const wQuality = parseWeight(sp.wQuality, 25);

  const rows = await getVendorPerformanceRows({ wReturn, wRecon, wScrap, wQuality });

  const fmt = (v: number | null) => (v === null ? "N/A" : v.toFixed(1) + "%");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Vendor Performance</h1>
          <p className="text-sm text-slate-500">
            Weighted score - Return Timeliness {wReturn}%, Reconciliation {wRecon}%, Scrap Recovery {wScrap}%, Quality {wQuality}%
            (weights normalize to 100% automatically; append <code className="rounded bg-slate-100 px-1">?wReturn=&amp;wRecon=&amp;wScrap=&amp;wQuality=</code> to
            the URL to try different weightings - there is no persistent settings UI for this yet).
          </p>
        </div>
        <a href={"/reports/vendor-performance/export?wReturn=" + wReturn + "&wRecon=" + wRecon + "&wScrap=" + wScrap + "&wQuality=" + wQuality} className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Export CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 text-right font-medium">Return Timeliness</th>
              <th className="px-3 py-2 text-right font-medium">Reconciliation</th>
              <th className="px-3 py-2 text-right font-medium">Scrap Recovery</th>
              <th className="px-3 py-2 text-right font-medium">Quality</th>
              <th className="px-3 py-2 text-right font-medium">Overall Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">No active vendors.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.vendorId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{r.vendorName}</div>
                    <div className="font-mono text-xs text-slate-400">{r.vendorCode}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.returnTimelinessScore)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.reconciliationScore)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.scrapRecoveryScore)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.qualityScore)}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={
                        r.overallScore === null
                          ? "text-slate-400"
                          : r.overallScore >= 90
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
                            : r.overallScore >= 70
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                              : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
                      }
                    >
                      {fmt(r.overallScore)}
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
