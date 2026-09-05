import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { getVendorScope } from "@/server/dcs/vendor-scope";

export const dynamic = "force-dynamic";

export default async function ReconciliationListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const user = await getSessionUser();

  const whereClause: Record<string, unknown> = status ? { status: status as never } : {};
  const vendorScope = getVendorScope(user);
  if (vendorScope.vendorId) {
    whereClause.dc = vendorScope;
  }

  const reconciliations = await prisma.reconciliation.findMany({
    where: whereClause,
    include: { dc: { include: { vendor: true } } },
    orderBy: { calculatedAt: "desc" },
    take: 200,
  });

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-slate-100 text-slate-600",
    BALANCED: "bg-blue-100 text-blue-700",
    EXCEPTION: "bg-red-100 text-red-700",
    RECONCILED: "bg-green-100 text-green-700",
    CLOSED: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Reconciliation</h1>
        <p className="text-sm text-slate-500">{reconciliations.length} record(s){status ? ` — ${status}` : ""}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">DC No</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium text-right">Input</th>
              <th className="px-4 py-2 font-medium text-right">Accounted</th>
              <th className="px-4 py-2 font-medium text-right">Unaccounted</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Calculated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reconciliations.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No reconciliation records.</td></tr>
            ) : (
              reconciliations.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/dcs/${r.dcId}`} className="font-mono text-blue-700 hover:underline">
                      {r.dc.dcNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-900">{r.dc.supplierNameSnapshot || r.dc.vendor?.vendorName || "INTERNAL"}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(r.totalInputWeight).toFixed(3)} kg</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(r.accountedWeight).toFixed(3)} kg</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(r.unaccountedWeight).toFixed(3)} kg</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.calculatedAt.toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}