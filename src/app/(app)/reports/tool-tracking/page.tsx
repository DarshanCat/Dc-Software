import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { prisma } from "@/lib/db";
import { getToolsWithVendor, summarizeByVendor } from "@/server/reports/tool-tracking";

export const dynamic = "force-dynamic";

export default async function ToolTrackingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ vendorId?: string }>;
}) {
  const { vendorId } = await searchParams;
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

  const [rows, vendors] = await Promise.all([
    getToolsWithVendor({ vendorId: vendorId || undefined }),
    prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" }, select: { id: true, vendorName: true } }),
  ]);

  const summary = summarizeByVendor(rows);
  const exportQuery = vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : "";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Tools Currently With Vendor</h1>
          <p className="text-sm text-slate-500">
            Tool DCs dispatched out and not yet returned (status DISPATCHED / AT_VENDOR), by serialized Tool Instance.
          </p>
        </div>
        {canExport && (
          <div className="flex shrink-0 gap-2">
            <a href={`/reports/tool-tracking/export${exportQuery}`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Export CSV
            </a>
            <a href={`/reports/tool-tracking/export-pdf${exportQuery}`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Export PDF
            </a>
          </div>
        )}
      </div>

      <form className="flex items-end gap-3 rounded-lg border border-slate-200 bg-white p-4" action="/reports/tool-tracking">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Vendor</label>
          <select name="vendorId" defaultValue={vendorId ?? ""} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.vendorName}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-9 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white">Filter</button>
        <a href="/reports/tool-tracking" className="flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700">Clear</a>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Tools With Vendor</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{rows.reduce((sum, r) => sum + r.quantity, 0)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vendors Holding Tools</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open Tool DCs</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{new Set(rows.map((r) => r.dcId)).size}</p>
        </div>
      </div>

      {!vendorId && summary.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 text-right font-medium">Tools With Vendor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.map((s) => (
                <tr key={s.vendorId ?? s.vendorName} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-900">{s.vendorName}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.toolCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC Number</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Tool Code</th>
              <th className="px-3 py-2 font-medium">Tool Name</th>
              <th className="px-3 py-2 font-medium">Serial No.</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Days Out</th>
              <th className="px-3 py-2 font-medium">Expected Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">No tools currently with any vendor.</td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={`${r.dcId}-${r.serialNumber}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-900">{r.dcNumber}</td>
                  <td className="px-3 py-2 text-slate-800">{r.vendorName}</td>
                  <td className="px-3 py-2 font-mono text-slate-800">{r.toolCode}</td>
                  <td className="px-3 py-2 text-slate-800">{r.toolName}</td>
                  <td className="px-3 py-2 font-mono text-slate-800">{r.serialNumber}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.quantity}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.daysOut !== null ? (
                      <span className={r.daysOut > 30 ? "font-semibold text-red-600" : ""}>{r.daysOut}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.expectedReturnDate ? r.expectedReturnDate.toLocaleDateString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
