import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import type { DcStatus } from "@prisma/client";

const TERMINAL_STATUSES: DcStatus[] = ["CLOSED", "CANCELLED"];

export default async function OverdueDcsPage() {
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.DASHBOARD_VIEW) : false;

  if (!canView) {
    return <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">You do not have permission to view this.</div>;
  }

  const now = new Date();
  const dcs = await prisma.deliveryChallan.findMany({
    where: {
      status: { notIn: TERMINAL_STATUSES },
      expectedReturnDate: { lt: now },
    },
    include: { vendor: true, process: true },
    orderBy: { expectedReturnDate: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Overdue DCs</h1>
        <p className="text-sm text-slate-500">{dcs.length} DC(s) past their expected return date</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC No</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Process</th>
              <th className="px-3 py-2 font-medium">Expected Return</th>
              <th className="px-3 py-2 text-right font-medium">Days Overdue</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dcs.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No overdue DCs right now.</td></tr>
            ) : (
              dcs.map((dc) => {
                const days = dc.expectedReturnDate
                  ? Math.floor((now.getTime() - dc.expectedReturnDate.getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                return (
                  <tr key={dc.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={"/dcs/" + dc.id} className="font-mono text-blue-700 hover:underline">{dc.dcNumber}</Link>
                    </td>
                    <td className="px-3 py-2 text-slate-900">{dc.vendor.vendorName}</td>
                    <td className="px-3 py-2 text-slate-600">{dc.process?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{dc.expectedReturnDate?.toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{days}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{dc.status.replace(/_/g, " ")}</span>
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