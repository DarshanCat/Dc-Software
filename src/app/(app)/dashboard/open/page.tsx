import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import type { DcStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const TERMINAL_STATUSES: DcStatus[] = ["CLOSED", "CANCELLED"];

export default async function OpenDcsPage() {
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.DASHBOARD_VIEW) : false;

  if (!canView) {
    return <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">You do not have permission to view this.</div>;
  }

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { notIn: TERMINAL_STATUSES } },
    include: { vendor: true, process: true },
    orderBy: { dcDate: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Open DCs</h1>
        <p className="text-sm text-slate-500">{dcs.length} DC(s) not yet closed or cancelled</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC No</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Process</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dcs.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No open DCs.</td></tr>
            ) : (
              dcs.map((dc) => (
                <tr key={dc.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={"/dcs/" + dc.id} className="font-mono text-blue-700 hover:underline">{dc.dcNumber}</Link>
                  </td>
                  <td className="px-3 py-2 text-slate-900">{dc.vendor?.vendorName || dc.supplierNameSnapshot || "N/A"}</td>
                  <td className="px-3 py-2 text-slate-600">{dc.process?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{dc.dcDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{dc.status.replace(/_/g, " ")}</span>
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