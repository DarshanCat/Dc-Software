import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  DISPATCHED: "bg-indigo-100 text-indigo-700",
  RECONCILIATION: "bg-purple-100 text-purple-700",
  RECONCILED: "bg-green-100 text-green-700",
  CLOSED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function DcsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; overdue?: string }>;
}) {
  const { status, overdue } = await searchParams;
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.DC_CREATE) : false;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (overdue === "1") {
    where.expectedReturnDate = { lt: new Date() };
    where.status = { notIn: ["CLOSED", "CANCELLED", "RECONCILED"] };
  }

  const dcs = await prisma.deliveryChallan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { vendor: true, process: true, items: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Delivery Challans</h1>
          <p className="text-sm text-slate-500">{dcs.length} DC(s)</p>
        </div>
        {canCreate && (
          <Link href="/dcs/new"><Button>Create DC</Button></Link>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">DC No</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Process</th>
              <th className="px-4 py-2 font-medium">Input Wt</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dcs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No DCs yet.</td></tr>
            ) : (
              dcs.map((dc) => {
                const inputWt = dc.items.reduce((sum, it) => sum + Number(it.inputWeight), 0);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link href={`/dcs/${dc.id}`} className="font-mono text-blue-700 hover:underline">
                        {dc.dcNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{dc.dcDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-slate-900">{dc.vendor.vendorName}</td>
                    <td className="px-4 py-2 text-slate-600">{dc.process?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{inputWt.toFixed(3)} kg</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[dc.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {dc.status.replace(/_/g, " ")}
                      </span>
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