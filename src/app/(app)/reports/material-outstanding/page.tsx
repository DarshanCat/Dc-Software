import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MaterialOutstandingReportPage() {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED", "CLOSED"] } },
    include: { vendor: true, receipts: { include: { items: true } } },
  });

  const byVendor = new Map<string, { name: string; sentWeight: number; returnedWeight: number; dcCount: number }>();
  for (const dc of dcs) {
    if (!dc.vendorId) continue;
    const sentWeight = Number(dc.rmQuantity ?? 0);
    const returnedWeight = dc.receipts.reduce(
      (s, r) => s + r.items.reduce((si, ri) => si + Number(ri.weightReceived), 0), 0);
    const entry = byVendor.get(dc.vendorId) ?? { name: dc.vendor?.vendorName || dc.supplierNameSnapshot || "N/A", sentWeight: 0, returnedWeight: 0, dcCount: 0 };
    entry.sentWeight += sentWeight;
    entry.returnedWeight += returnedWeight;
    entry.dcCount += 1;
    byVendor.set(dc.vendorId, entry);
  }

  const rows = Array.from(byVendor.values()).sort((a, b) => (b.sentWeight - b.returnedWeight) - (a.sentWeight - a.returnedWeight));

  return (
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Material Outstanding</h1>
          <p className="text-sm text-slate-500">Material currently outside, by vendor</p>
        </div>
        <a href="/reports/material-outstanding/export" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Export CSV
        </a>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium text-right">Open DCs</th>
              <th className="px-4 py-2 font-medium text-right">Sent Weight</th>
              <th className="px-4 py-2 font-medium text-right">Returned Weight</th>
              <th className="px-4 py-2 font-medium text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No open material.</td></tr>
            ) : (
              rows.map((r) => {
                const outstanding = Math.max(0, r.sentWeight - r.returnedWeight);
                return (
                  <tr key={r.name} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-900">{r.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.dcCount}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.sentWeight.toFixed(3)} kg</td>
                    <td className="px-4 py-2 text-right font-mono">{r.returnedWeight.toFixed(3)} kg</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{outstanding.toFixed(3)} kg</td>
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