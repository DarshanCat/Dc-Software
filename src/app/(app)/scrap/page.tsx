import Link from "next/link";
import { prisma } from "@/lib/db";
import { evaluateScrap } from "@/services/scrap.service";

type ScrapView = "all" | "expected" | "received" | "outstanding" | "exceptions";

export default async function ScrapDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const activeView = (view as ScrapView) ?? "all";

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED"] } },
    include: { vendor: true, items: true, scrapReceipts: { include: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows = dcs.map((dc) => {
    const expectedScrapWeight = dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
    const receivedScrapWeight = dc.scrapReceipts.reduce(
      (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0), 0);
    const tolerance = dc.items.length > 0 ? Number(dc.items[0].tolerancePercentage) : 0;
    const evalResult = evaluateScrap(expectedScrapWeight, receivedScrapWeight, tolerance);
    return { dc, expectedScrapWeight, receivedScrapWeight, evalResult };
  });

  const filtered = rows.filter((r) => {
    if (activeView === "expected") return r.expectedScrapWeight > 0;
    if (activeView === "received") return r.receivedScrapWeight > 0;
    if (activeView === "outstanding") return r.expectedScrapWeight - r.receivedScrapWeight > 0.001;
    if (activeView === "exceptions") return r.evalResult.status === "SCRAP_SHORT" || r.evalResult.status === "EXCESS_SCRAP";
    return true;
  });

  const tabs: { key: ScrapView; label: string; href: string }[] = [
    { key: "all", label: "Scrap Dashboard", href: "/scrap" },
    { key: "expected", label: "Expected Scrap", href: "/scrap?view=expected" },
    { key: "received", label: "Received Scrap", href: "/scrap?view=received" },
    { key: "outstanding", label: "Scrap Outstanding", href: "/scrap?view=outstanding" },
    { key: "exceptions", label: "Scrap Exceptions", href: "/scrap?view=exceptions" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Scrap Recovery</h1>
        <p className="text-sm text-slate-500">{filtered.length} DC(s)</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`rounded-md px-3 py-1.5 ${
              activeView === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">DC No</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium text-right">Expected Scrap</th>
              <th className="px-4 py-2 font-medium text-right">Received Scrap</th>
              <th className="px-4 py-2 font-medium text-right">Recovery %</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No DCs match this view.</td></tr>
            ) : (
              filtered.map(({ dc, expectedScrapWeight, receivedScrapWeight, evalResult }) => (
                <tr key={dc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/dcs/${dc.id}`} className="font-mono text-blue-700 hover:underline">
                      {dc.dcNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-900">{dc.vendor.vendorName}</td>
                  <td className="px-4 py-2 text-right font-mono">{expectedScrapWeight.toFixed(3)} kg</td>
                  <td className="px-4 py-2 text-right font-mono">{receivedScrapWeight.toFixed(3)} kg</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {evalResult.recoveryPercent === null ? "N/A" : `${evalResult.recoveryPercent.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        evalResult.status === "SCRAP_SHORT"
                          ? "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
                          : evalResult.status === "EXCESS_SCRAP"
                            ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                            : evalResult.status === "NOT_APPLICABLE"
                              ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                              : "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                      }
                    >
                      {evalResult.status.replace(/_/g, " ")}
                    </span>
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