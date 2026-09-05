import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import type { ExceptionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const OPEN_STATUSES: ExceptionStatus[] = ["OPEN", "UNDER_REVIEW", "REJECTED"];

export default async function ExceptionsPage() {
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.DASHBOARD_VIEW) : false;

  if (!canView) {
    return <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">You do not have permission to view this.</div>;
  }

  const exceptions = await prisma.exception.findMany({
    where: { status: { in: OPEN_STATUSES } },
    include: { dc: { include: { vendor: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Reconciliation Exceptions</h1>
        <p className="text-sm text-slate-500">{exceptions.length} unresolved exception(s) across all DCs</p>
      </div>

      <div className="space-y-3">
        {exceptions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-400">
            No unresolved exceptions right now.
          </div>
        ) : (
          exceptions.map((e) => (
            <div key={e.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Link href={"/dcs/" + e.dcId} className="font-mono text-sm text-blue-700 hover:underline">
                    {e.dc.dcNumber}
                  </Link>
                  <span className="ml-2 text-sm text-slate-500">{e.dc.vendor?.vendorName || e.dc.supplierNameSnapshot || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{e.type.replace(/_/g, " ")}</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{e.status.replace(/_/g, " ")}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-700">{e.description}</p>
              {e.variance !== null && (
                <p className="mt-1 text-xs text-slate-400">Variance: {Number(e.variance).toFixed(3)} kg</p>
              )}
              <p className="mt-1 text-xs text-slate-400">Opened {e.createdAt.toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}