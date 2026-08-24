import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ wo?: string }>;
}) {
  const { wo } = await searchParams;

  const dcs = await prisma.deliveryChallan.findMany({
    where: wo ? { woNumber: { contains: wo, mode: "insensitive" } } : undefined,
    include: { vendor: true, process: true, items: true, receipts: { include: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const byWo = new Map<string, typeof dcs>();
  for (const dc of dcs) {
    const list = byWo.get(dc.woNumber) ?? [];
    list.push(dc);
    byWo.set(dc.woNumber, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Work Orders</h1>
        <p className="text-sm text-slate-500">
          {byWo.size} WO ID(s) · {dcs.length} DC(s){wo ? ` — matching "${wo}"` : ""}
        </p>
      </div>

      <form className="flex gap-2" action="/work-orders">
        <input
          name="wo"
          defaultValue={wo ?? ""}
          placeholder="Search by WO ID…"
          className="h-10 w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <button className="rounded-md bg-slate-900 px-4 text-sm font-medium text-white" type="submit">
          Search
        </button>
      </form>

      {Array.from(byWo.entries()).length === 0 ? (
        <p className="text-sm text-slate-400">No DCs found for this WO ID.</p>
      ) : (
        <div className="space-y-6">
          {Array.from(byWo.entries()).map(([woNumber, group]) => {
            const totalSent = group.reduce((s, dc) => s + dc.items.reduce((si, it) => si + Number(it.quantity), 0), 0);
            const totalReturned = group.reduce(
              (s, dc) => s + dc.receipts.reduce(
                (sr, r) => sr + r.items.reduce((sri, ri) => sri + Number(ri.quantityReceived), 0), 0), 0);
            return (
              <div key={woNumber} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-mono text-sm font-semibold text-slate-900">{woNumber}</h2>
                  <span className="text-xs text-slate-500">
                    Sent {totalSent} · Returned {totalReturned}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1">DC No</th>
                      <th>Vendor</th>
                      <th>Process</th>
                      <th className="text-right">Qty</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((dc) => (
                      <tr key={dc.id} className="border-t border-slate-100">
                        <td className="py-1.5">
                          <Link href={`/dcs/${dc.id}`} className="font-mono text-blue-700 hover:underline">
                            {dc.dcNumber}
                          </Link>
                        </td>
                        <td>{dc.vendor.vendorName}</td>
                        <td>{dc.process?.name ?? "—"}</td>
                        <td className="text-right font-mono">
                          {dc.items.reduce((s, it) => s + Number(it.quantity), 0)}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[dc.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {dc.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}