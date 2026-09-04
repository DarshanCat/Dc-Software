import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { getVendorScope } from "@/server/dcs/vendor-scope";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string; partial?: string }>;
}) {
  const { pending, partial } = await searchParams;
  const user = await getSessionUser();

  const receipts = await prisma.materialReceipt.findMany({
    where: { ...getVendorScope(user) },
    orderBy: { receiptDate: "desc" },
    include: {
      dc: { include: { vendor: true } },
      items: true,
    },
    take: 200,
  });

  const filtered = receipts.filter((r) => {
    if (pending === "1") return r.dc.status !== "MATERIAL_RETURNED" && r.dc.status !== "RECONCILIATION" && r.dc.status !== "RECONCILED" && r.dc.status !== "CLOSED";
    if (partial === "1") return r.dc.status === "PARTIALLY_RETURNED";
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Material Returns</h1>
        <p className="text-sm text-slate-500">{filtered.length} receipt(s)</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Receipt No</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">DC No</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium text-right">Qty Received</th>
              <th className="px-4 py-2 font-medium text-right">Weight Received</th>
              <th className="px-4 py-2 font-medium">DC Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No receipts found.</td></tr>
            ) : (
              filtered.map((r) => {
                const qty = r.items.reduce((s, it) => s + Number(it.quantityReceived), 0);
                const weight = r.items.reduce((s, it) => s + Number(it.weightReceived), 0);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-700">{r.receiptNumber}</td>
                    <td className="px-4 py-2 text-slate-600">{r.receiptDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <Link href={`/dcs/${r.dcId}`} className="font-mono text-blue-700 hover:underline">
                        {r.dc.dcNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-900">{r.dc.vendor.vendorName}</td>
                    <td className="px-4 py-2 text-right font-mono">{qty}</td>
                    <td className="px-4 py-2 text-right font-mono">{weight.toFixed(3)} kg</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {r.dc.status.replace(/_/g, " ")}
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