import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { filterDcDataForRole } from "@/server/dcs/sanitizer";
import { getVendorScope } from "@/server/dcs/vendor-scope";
import { ROLE_ALLOWED_STATUSES } from "@/config/dc-visibility";
import { Button } from "@/components/ui/button";
import { DcListRowActions } from "./dc-list-actions";
import { formatQuantity } from "@/lib/quantity-format";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-300",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-blue-100 text-blue-800 border-blue-300",
  DISPATCHED: "bg-indigo-100 text-indigo-800 border-indigo-300",
  AT_VENDOR: "bg-purple-100 text-purple-800 border-purple-300",
  SECURITY_RETURNED: "bg-amber-100 text-amber-900 border-amber-400",
  STORE_VERIFIED: "bg-cyan-100 text-cyan-900 border-cyan-400",
  CUSTODIAN_VERIFIED: "bg-sky-100 text-sky-900 border-sky-400",
  QUALITY_COMPLETED: "bg-purple-100 text-purple-900 border-purple-400",
  FINAL_APPROVED: "bg-teal-100 text-teal-900 border-teal-400",
  APPROVED_FOR_PAYMENT: "bg-emerald-100 text-emerald-900 border-emerald-400",
  CLOSED: "bg-slate-200 text-slate-800 border-slate-400",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
};

const OUT_STATUSES = ["APPROVED", "DISPATCHED", "AT_VENDOR", "OUTWARD_CREATED", "MATERIAL_OUT"];
const INWARD_STATUSES = [
  "SECURITY_RETURNED",
  "INWARD_RECEIVED",
  "STORE_VERIFIED",
  "CUSTODIAN_VERIFIED",
  "QUALITY_COMPLETED",
  "FINAL_APPROVED",
  "APPROVED_FOR_PAYMENT",
  "CLOSED",
];

interface SearchParamsProps {
  status?: string;
  overdue?: string;
  flow?: string;
  materialCategory?: string;
  woNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

export default async function DcsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsProps>;
}) {
  const {
    status,
    overdue,
    flow = "ALL",
    materialCategory = "ALL",
    woNumber,
    dateFrom,
    dateTo,
    q,
  } = await searchParams;

  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.DC_CREATE) : false;
  const userRole = user?.roleKeys?.[0] || "GUEST";
  const roleKeys = user?.roleKeys || [];
  const isAdmin = roleKeys.includes("ADMIN");

  const where: Record<string, any> = {
    ...getVendorScope(user),
  };

  // Base role permission status filtering
  if (status) {
    if (status === "DRAFT" || status === "SENT_BACK") {
      where.status = { in: ["DRAFT", "SENT_BACK"] };
    } else {
      where.status = status;
    }
  } else if (!isAdmin) {
    let allowed: string[] = [];
    for (const r of roleKeys) {
      if (ROLE_ALLOWED_STATUSES[r]) {
        allowed = [...allowed, ...ROLE_ALLOWED_STATUSES[r]];
      }
    }
    const uniqueAllowed = [...new Set(allowed)];
    if (uniqueAllowed.length > 0) {
      where.status = { in: uniqueAllowed };
    }
  }

  // Material Flow Filter: OUT vs INWARD
  const upperFlow = (flow || "ALL").toUpperCase();
  if (upperFlow === "OUT") {
    if (where.status && typeof where.status === "object" && Array.isArray(where.status.in)) {
      where.status.in = where.status.in.filter((s: string) => OUT_STATUSES.includes(s));
    } else if (typeof where.status === "string") {
      if (!OUT_STATUSES.includes(where.status)) {
        where.status = "__NO_MATCH__";
      }
    } else {
      where.status = { in: OUT_STATUSES };
    }
  } else if (upperFlow === "INWARD") {
    if (where.status && typeof where.status === "object" && Array.isArray(where.status.in)) {
      where.status.in = where.status.in.filter((s: string) => INWARD_STATUSES.includes(s));
    } else if (typeof where.status === "string") {
      if (!INWARD_STATUSES.includes(where.status)) {
        where.status = "__NO_MATCH__";
      }
    } else {
      where.status = { in: INWARD_STATUSES };
    }
  }

  // Material Category Filter (PRODUCTION vs CONVERSION)
  const upperCategory = (materialCategory || "ALL").toUpperCase();
  if (upperCategory === "PRODUCTION" || upperCategory === "CONVERSION") {
    where.materialCategory = upperCategory;
  }

  // WO Number Filter
  if (woNumber && woNumber.trim()) {
    where.woNumber = { contains: woNumber.trim(), mode: "insensitive" };
  }

  // Date Range Filter
  if (dateFrom || dateTo) {
    const dateRange: Record<string, Date> = {};
    if (dateFrom) {
      dateRange.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      dateRange.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
    where.dcDate = dateRange;
  }

  // General Search Filter
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { dcNumber: { contains: term, mode: "insensitive" } },
      { woNumber: { contains: term, mode: "insensitive" } },
      { partNumber: { contains: term, mode: "insensitive" } },
      { supplierNameSnapshot: { contains: term, mode: "insensitive" } },
      { vendor: { vendorName: { contains: term, mode: "insensitive" } } },
    ];
  }

  if (overdue === "1") {
    where.expectedReturnDate = { lt: new Date() };
    where.status = { notIn: ["CLOSED", "CANCELLED", "RECONCILED"] };
  }

  const rawDcs = await prisma.deliveryChallan.findMany({
    where,
    orderBy: { dcDate: "desc" },
    include: { vendor: true, process: true },
    take: 200,
  });

  // Role sanitized DCs
  const dcs = rawDcs.map((dc) => filterDcDataForRole(dc, userRole));

  // Compute summary KPI counts over currently retrieved records
  const totalCount = dcs.length;
  const outCount = dcs.filter((d) => OUT_STATUSES.includes(d.status)).length;
  const inwardCount = dcs.filter((d) => INWARD_STATUSES.includes(d.status)).length;
  const productionCount = dcs.filter((d) => d.materialCategory !== "CONVERSION").length;
  const conversionCount = dcs.filter((d) => d.materialCategory === "CONVERSION").length;

  // Construct Export query string
  const exportParams = new URLSearchParams();
  if (dateFrom) exportParams.set("dateFrom", dateFrom);
  if (dateTo) exportParams.set("dateTo", dateTo);
  if (woNumber) exportParams.set("woNumber", woNumber);
  if (upperCategory !== "ALL") exportParams.set("materialCategory", upperCategory);
  if (upperFlow !== "ALL") exportParams.set("flow", upperFlow);
  if (q) exportParams.set("q", q);
  if (status) exportParams.set("status", status);
  const exportUrl = `/dcs/export?${exportParams.toString()}`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivery Challans</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time material movement tracking, vendor work orders &amp; digital softcopy generation
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Download CSV report of currently filtered Delivery Challans"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Filtered CSV
          </a>
          {canCreate && (
            <Link href="/dcs/new">
              <Button className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-sm">
                + Create DC
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Filtered</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
          <span className="text-[10px] text-slate-400">Total matching records</span>
        </div>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Material Out</p>
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-900 mt-1">{outCount}</p>
          <span className="text-[10px] text-indigo-600 font-medium">Dispatched / At Vendor</span>
        </div>

        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Material Inward</p>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{inwardCount}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Returned / Inwarded</span>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Production</p>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-1">{productionCount}</p>
          <span className="text-[10px] text-blue-600 font-medium">Standard Material</span>
        </div>

        <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">Conversion</p>
            <span className="h-2 w-2 rounded-full bg-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-900 mt-1">{conversionCount}</p>
          <span className="text-[10px] text-purple-600 font-medium">Conversion Material</span>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <form method="GET" action="/dcs" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Date From */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Date From
            </label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom || ""}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 2. Date To */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Date To
            </label>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo || ""}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 3. Work Order ID */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              WO ID (Work Order)
            </label>
            <input
              type="text"
              name="woNumber"
              defaultValue={woNumber || ""}
              placeholder="e.g. WO-2026-001"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* 4. Material Category */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Material Category
            </label>
            <select
              name="materialCategory"
              defaultValue={upperCategory}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">All Categories</option>
              <option value="PRODUCTION">Production Material</option>
              <option value="CONVERSION">Conversion Material</option>
            </select>
          </div>

          {/* 5. Material Movement Flow */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Material Movement
            </label>
            <select
              name="flow"
              defaultValue={upperFlow}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">All Movements</option>
              <option value="OUT">Material Out (At Vendor)</option>
              <option value="INWARD">Material Inward (Returned)</option>
            </select>
          </div>

          {/* 6. Keyword Search */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Search DC / Vendor
            </label>
            <input
              type="text"
              name="q"
              defaultValue={q || ""}
              placeholder="DC No, Vendor, Part..."
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Showing <strong>{dcs.length}</strong> matching Delivery Challan(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dcs"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Reset
            </Link>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      {/* DC Table List */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">DC No</th>
                <th className="px-3 py-2.5 font-bold">Date</th>
                <th className="px-3 py-2.5 font-bold">Category</th>
                <th className="px-3 py-2.5 font-bold">Movement</th>
                <th className="px-3.5 py-2.5 font-bold">Vendor / Party</th>
                <th className="px-3 py-2.5 font-bold">WO ID</th>
                <th className="px-3 py-2.5 font-bold">Part &amp; Dimensions</th>
                <th className="px-3 py-2.5 font-bold text-right">RM Qty</th>
                <th className="px-3 py-2.5 font-bold text-right">Exp FG</th>
                <th className="px-3 py-2.5 font-bold text-right">Weight (KG)</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3.5 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {dcs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-400 italic">
                    <p className="font-semibold text-sm text-slate-600 not-italic">No Delivery Challans found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              ) : (
                dcs.map((dc) => {
                  const rmQty = Number(dc.rmQuantity ?? 0);
                  const expFg = Number(dc.returnFgQuantity ?? 0);
                  const rmUom = dc.rmUom || "NOS";
                  const fgUom = dc.fgUom || "NOS";
                  const weightKg = dc.outwardWeight != null ? Number(dc.outwardWeight) : null;
                  const isOut = OUT_STATUSES.includes(dc.status);
                  const isInward = INWARD_STATUSES.includes(dc.status);
                  const isConversion = dc.materialCategory === "CONVERSION";
                  const dimensionsText =
                    dc.length != null && dc.width != null && dc.height != null
                      ? `${Number(dc.length)} × ${Number(dc.width)} × ${Number(dc.height)} MM`
                      : null;

                  return (
                    <tr key={dc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. DC No */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <Link href={`/dcs/${dc.id}`} className="font-mono font-bold text-blue-700 hover:underline">
                          {dc.dcNumber}
                        </Link>
                      </td>

                      {/* 2. Date */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-medium">
                        {dc.dcDate.toLocaleDateString()}
                      </td>

                      {/* 3. Material Category */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                            isConversion
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {isConversion ? "Conversion" : "Production"}
                        </span>
                      </td>

                      {/* 4. Movement Flow */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            Material Out
                          </span>
                        ) : isInward ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Material Inward
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            Internal
                          </span>
                        )}
                      </td>

                      {/* 5. Vendor */}
                      <td className="px-3.5 py-2.5 max-w-[180px] truncate font-semibold text-slate-900" title={dc.vendor?.vendorName || dc.supplierNameSnapshot || ""}>
                        {dc.vendor?.vendorName || dc.supplierNameSnapshot || (dc.destinationDepartment ? `${dc.destinationDepartment} (${dc.responsibleCustodian || ''})` : "Internal Custody")}
                      </td>

                      {/* 6. WO ID */}
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono font-bold text-slate-800">
                        {dc.woNumber || "—"}
                      </td>

                      {/* 7. Part & Dimensions */}
                      <td className="px-3 py-2.5">
                        <div className="font-mono font-semibold text-slate-900 leading-tight">
                          {dc.partNumberSnapshot || dc.partNumber || "—"}
                        </div>
                        {dimensionsText && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {dimensionsText}
                          </div>
                        )}
                      </td>

                      {/* 8. RM Qty */}
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {formatQuantity(rmQty, rmUom)}
                      </td>

                      {/* 9. FG Qty */}
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {formatQuantity(expFg, fgUom)}
                      </td>

                      {/* 10. Weight (KG) */}
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {weightKg != null ? `${weightKg.toFixed(3)} KG` : "—"}
                      </td>

                      {/* 11. Status */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[dc.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {dc.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* 12. Actions */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <DcListRowActions
                          dcId={dc.id}
                          dcNumber={dc.dcNumber}
                          status={dc.status}
                          canEdit={canCreate}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
