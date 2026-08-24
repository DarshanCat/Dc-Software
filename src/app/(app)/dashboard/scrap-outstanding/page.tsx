import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import type { DcStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const SCRAP_PENDING_STATUSES: DcStatus[] = ["MATERIAL_RETURNED", "SCRAP_PENDING"];

export default async function ScrapOutstandingPage() {
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.DASHBOARD_VIEW) : false;

  if (!canView) {
    return <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">You do not have permission to view this.</div>;
  }

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { in: SCRAP_PENDING_STATUSES } },
    include: { vendor: true, items: true, scrapReceipts: { include: { items: true } } },
    orderBy: { dcDate: "desc" },
  });

  const rows = dcs
    .map((dc) => {
      const expectedScrap = dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
      const receivedScrap = dc.scrapReceipts.reduce(
        (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
        0,
      );
      const outstanding = Math.max(expectedScrap - receivedScrap, 0);
      return { dcId: dc.id, dcNumber: dc.dcNumber, vendorName: dc.vendor.vendorName, expectedScrap, receivedScrap, outstanding };
    })
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  const total = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Scrap Outstanding</h1>
        <p className="text-sm text-slate-500">{rows.length} DC(s), {total.toFixed(3)} kg total scrap still owed</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC No</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 text-right font-medium">Expected Scrap</th>
              <th className="px-3 py-2 text-right font-medium">Received Scrap</th>
              <th className="px-3 py-2 text-right font-medium">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No scrap outstanding right now.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.dcId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={"/dcs/" + r.dcId} className="font-mono text-blue-700 hover:underline">{r.dcNumber}</Link>
                  </td>
                  <td className="px-3 py-2 text-slate-900">{r.vendorName}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.expectedScrap.toFixed(3)} kg</td>
                  <td className="px-3 py-2 text-right font-mono">{r.receivedScrap.toFixed(3)} kg</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{r.outstanding.toFixed(3)} kg</span>
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