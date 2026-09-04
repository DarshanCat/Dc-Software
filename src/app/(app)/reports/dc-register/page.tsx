import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getDcRegisterRows } from "@/server/reports/dc-register";

import { getVendorScope } from "@/server/dcs/vendor-scope";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const DC_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "DISPATCHED", "AT_VENDOR",
  "PARTIALLY_RETURNED", "MATERIAL_RETURNED", "SCRAP_PENDING",
  "RECONCILIATION", "RECONCILED", "CLOSED", "CANCELLED",
];
const DC_PURPOSES = [
  "JOB_WORK", "MACHINING", "HEAT_TREATMENT", "SURFACE_TREATMENT",
  "REPAIR", "SAMPLE", "TRIAL", "SUBCONTRACTING", "OTHER",
];

interface SearchParams {
  vendorId?: string;
  status?: string;
  purpose?: string;
  processId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}

export default async function DcRegisterReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
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

  const page = Math.max(1, Number(sp.page) || 1);
  const vendorScope = getVendorScope(user);
  const filters = {
    vendorId: vendorScope.vendorId ?? (sp.vendorId || undefined),
    status: sp.status || undefined,
    purpose: sp.purpose || undefined,
    processId: sp.processId || undefined,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
  };

  const [{ rows, total }, vendors, processes] = await Promise.all([
    getDcRegisterRows(filters, { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" } }),
    prisma.process.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return "?" + params.toString();
  };

  const exportHref = "/reports/dc-register/export" + qs({ page: undefined });
  const exportLinkClass = "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">DC Register</h1>
          <p className="text-sm text-slate-500">{total} DC(s) matching current filters</p>
        </div>
        {canExport && (
          <a href={exportHref} className={exportLinkClass}>Export CSV</a>
        )}
      </div>

      <form method="GET" className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Vendor</label>
          <select name="vendorId" defaultValue={sp.vendorId ?? ""} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">All</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.vendorName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <select name="status" defaultValue={sp.status ?? ""} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">All</option>
            {DC_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Purpose</label>
          <select name="purpose" defaultValue={sp.purpose ?? ""} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">All</option>
            {DC_PURPOSES.map((p) => (
              <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Process</label>
          <select name="processId" defaultValue={sp.processId ?? ""} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="">All</option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input type="date" name="dateFrom" defaultValue={sp.dateFrom ?? ""} className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input type="date" name="dateTo" defaultValue={sp.dateTo ?? ""} className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
        </div>
        <div className="col-span-2 flex items-end gap-2 md:col-span-6">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Apply Filters
          </button>
          <Link href="/reports/dc-register" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Clear
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC No</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Part No</th>
              <th className="px-3 py-2 text-right font-medium">RM Qty</th>
              <th className="px-3 py-2 text-right font-medium">Return FG Qty</th>
              <th className="px-3 py-2 font-medium">Heat No</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Process</th>
              <th className="px-3 py-2 font-medium">Expected Return</th>
              <th className="px-3 py-2 text-right font-medium">Received</th>
              <th className="px-3 py-2 text-right font-medium">Actual Scrap</th>
              <th className="px-3 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-slate-400">
                  No DCs match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.dcId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={"/dcs/" + r.dcId} className="font-mono text-blue-700 hover:underline">
                      {r.dcNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.dcDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{r.partNumber}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.rmQuantity.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.returnFgQuantity.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{r.heatNumber}</td>
                  <td className="px-3 py-2 text-slate-900">{r.vendorName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.processName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.expectedReturnDate ? r.expectedReturnDate.toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.receivedQuantity}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.scrapWeight.toFixed(3)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qs({ page: String(page - 1) })} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={qs({ page: String(page + 1) })} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}