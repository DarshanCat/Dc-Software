import { prisma } from "@/lib/db";
import { evaluateScrap } from "@/services/scrap.service";

export default async function ScrapRecoveryReportPage() {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED"] } },
    include: { vendor: true, items: true, scrapReceipts: { include: { items: true } } },
  });

  const byVendor = new Map<string, { name: string; expected: number; received: number; dcCount: number }>();
  for (const dc of dcs) {
    const expected = dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
    const received = dc.scrapReceipts.reduce(
      (s, r) => s + r.items.reduce((si, ri) => si + Number(ri.weight), 0), 0);
    if (expected <= 0 && received <= 0) continue;
    const entry = byVendor.get(dc.vendorId) ?? { name: dc.vendor.vendorName, expected: 0, received: 0, dcCount: 0 };
    entry.expected += expected;
    entry.received += received;
    entry.dcCount += 1;
    byVendor.set(dc.vendorId, entry);
  }

  const rows = Array.from(byVendor.values());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Scrap Recovery Report</h1>
        <p className="text-sm text-slate-500">Scrap expected vs. recovered, by vendor</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium text-right">DCs</th>
              <th className="px-4 py-2 font-medium text-right">Expected Scrap</th>
              <th className="px-4 py-2 font-medium text-right">Received Scrap</th>
              <th className="px-4 py-2 font-medium text-right">Recovery %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No scrap data yet.</td></tr>
            ) : (
              rows.map((r) => {
                const evalResult = evaluateScrap(r.expected, r.received, 0);
                return (
                  <tr key={r.name} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-900">{r.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.dcCount}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.expected.toFixed(3)} kg</td>
                    <td className="px-4 py-2 text-right font-mono">{r.received.toFixed(3)} kg</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {evalResult.recoveryPercent === null ? "N/A" : `${evalResult.recoveryPercent.toFixed(1)}%`}
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