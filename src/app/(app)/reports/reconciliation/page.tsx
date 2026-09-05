import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["BALANCED", "EXCEPTION", "RECONCILED", "CLOSED"];

interface SearchParams {
  status?: string;
}

export default async function ReconciliationReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.RECONCILIATION_VIEW) : false;

  if (!canView) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to view reconciliation.
      </div>
    );
  }

  const where: Record<string, unknown> = {};
  if (sp.status) where.status = sp.status;

  const reconciliations = await prisma.reconciliation.findMany({
    where,
    include: {
      dc: {
        include: {
          vendor: true,
          exceptions: { orderBy: { createdAt: "asc" } },
        },
      },
    },
    orderBy: { calculatedAt: "desc" },
  });

  const openExceptionCount = (exceptions: { status: string }[]) =>
    exceptions.filter((e) => ["OPEN", "UNDER_REVIEW", "REJECTED"].includes(e.status)).length;

  const totalOpenExceptions = reconciliations.reduce((sum, r) => sum + openExceptionCount(r.dc.exceptions), 0);

  const qs = (status: string | undefined) => (status ? "?status=" + status : "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Reconciliation</h1>
          <p className="text-sm text-slate-500">
            {reconciliations.length} reconciliation(s) - {totalOpenExceptions} unresolved exception(s) across all DCs.
          </p>
        </div>
        <a href={"/reports/reconciliation/export" + qs(sp.status)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/reports/reconciliation"
          className={
            !sp.status
              ? "rounded-full bg-slate-900 px-3 py-1 text-xs text-white"
              : "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          }
        >
          All
        </Link>
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={"/reports/reconciliation" + qs(s)}
            className={
              sp.status === s
                ? "rounded-full bg-slate-900 px-3 py-1 text-xs text-white"
                : "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            }
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC No</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 text-right font-medium">Input</th>
              <th className="px-3 py-2 text-right font-medium">Accounted</th>
              <th className="px-3 py-2 text-right font-medium">Unaccounted</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Open Exceptions</th>
              <th className="px-3 py-2 font-medium">Calculated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reconciliations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  No reconciliations match the current filter.
                </td>
              </tr>
            ) : (
              reconciliations.map((r) => {
                const openCount = openExceptionCount(r.dc.exceptions);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={"/dcs/" + r.dcId} className="font-mono text-blue-700 hover:underline">
                        {r.dc.dcNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-900">{r.dc.vendor?.vendorName || r.dc.supplierNameSnapshot || "N/A"}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(r.totalInputWeight).toFixed(3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(r.accountedWeight).toFixed(3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(r.unaccountedWeight).toFixed(3)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "BALANCED"
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                            : r.status === "CLOSED"
                              ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                              : "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {openCount > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{openCount} open</span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {r.calculatedAt ? r.calculatedAt.toLocaleString() : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
