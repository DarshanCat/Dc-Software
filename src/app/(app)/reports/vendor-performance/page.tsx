import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";

export const dynamic = "force-dynamic";

const FULLY_RETURNED_ONWARD = ["MATERIAL_RETURNED", "SCRAP_PENDING", "RECONCILIATION", "RECONCILED", "CLOSED"];

interface SearchParams {
  wReturn?: string;
  wRecon?: string;
  wScrap?: string;
  wQuality?: string;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default async function VendorPerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.REPORT_VIEW) : false;

  if (!canView) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to view reports.
      </div>
    );
  }

  const wReturn = num(sp.wReturn, 25);
  const wRecon = num(sp.wRecon, 25);
  const wScrap = num(sp.wScrap, 25);
  const wQuality = num(sp.wQuality, 25);

  const vendors = await prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" } });

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      vendor: true,
      dispatch: true,
      reconciliation: true,
      receipts: { include: { items: true } },
      scrapReceipts: { include: { items: true } },
      items: true,
    },
  });

  const dcsByVendor = new Map<string, typeof dcs>();
  for (const dc of dcs) {
    const list = dcsByVendor.get(dc.vendorId) ?? [];
    list.push(dc);
    dcsByVendor.set(dc.vendorId, list);
  }

  const rows = vendors.map((vendor) => {
    const vendorDcs = dcsByVendor.get(vendor.id) ?? [];

    let timelyCount = 0;
    let timelinessEligible = 0;
    let balancedCount = 0;
    let reconciledEligible = 0;
    let totalExpectedScrap = 0;
    let totalReceivedScrap = 0;
    let totalGrossReceived = 0;
    let totalRejected = 0;

    for (const dc of vendorDcs) {
      if (FULLY_RETURNED_ONWARD.includes(dc.status) && dc.dispatch && dc.expectedReturnDate && dc.receipts.length > 0) {
        timelinessEligible++;
        const lastReceipt = [...dc.receipts].sort((a, b) => b.receiptDate.getTime() - a.receiptDate.getTime())[0];
        if (lastReceipt.receiptDate <= dc.expectedReturnDate) timelyCount++;
      }

      if (dc.reconciliation) {
        reconciledEligible++;
        if (dc.reconciliation.status === "BALANCED" || dc.reconciliation.status === "CLOSED") balancedCount++;
      }

      totalExpectedScrap += dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
      totalReceivedScrap += dc.scrapReceipts.reduce(
        (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
        0,
      );

      for (const receipt of dc.receipts) {
        for (const line of receipt.items) {
          totalGrossReceived += Number(line.weightReceived);
          totalRejected += Number(line.rejectedWeight);
        }
      }
    }

    const returnTimelinessScore = timelinessEligible > 0 ? (timelyCount / timelinessEligible) * 100 : null;
    const reconciliationScore = reconciledEligible > 0 ? (balancedCount / reconciledEligible) * 100 : null;
    const scrapRecoveryScore =
      totalExpectedScrap > 0 ? Math.min((totalReceivedScrap / totalExpectedScrap) * 100, 100) : null;
    const qualityScore = totalGrossReceived > 0 ? Math.max(0, 100 - (totalRejected / totalGrossReceived) * 100) : null;

    const parts: { score: number; weight: number }[] = [];
    if (returnTimelinessScore !== null) parts.push({ score: returnTimelinessScore, weight: wReturn });
    if (reconciliationScore !== null) parts.push({ score: reconciliationScore, weight: wRecon });
    if (scrapRecoveryScore !== null) parts.push({ score: scrapRecoveryScore, weight: wScrap });
    if (qualityScore !== null) parts.push({ score: qualityScore, weight: wQuality });

    const overallScore =
      parts.length > 0
        ? parts.reduce((sum, p) => sum + p.score * p.weight, 0) / parts.reduce((sum, p) => sum + p.weight, 0)
        : null;

    return {
      vendorId: vendor.id,
      vendorCode: vendor.vendorCode,
      vendorName: vendor.vendorName,
      returnTimelinessScore,
      reconciliationScore,
      scrapRecoveryScore,
      qualityScore,
      overallScore,
    };
  });

  rows.sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1));

  const fmt = (v: number | null) => (v === null ? "N/A" : v.toFixed(1) + "%");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Vendor Performance</h1>
          <p className="text-sm text-slate-500">
            Weighted score - Return Timeliness {wReturn}%, Reconciliation {wRecon}%, Scrap Recovery {wScrap}%, Quality {wQuality}%
            (weights normalize to 100% automatically; append <code className="rounded bg-slate-100 px-1">?wReturn=&amp;wRecon=&amp;wScrap=&amp;wQuality=</code> to
            the URL to try different weightings - there is no persistent settings UI for this yet).
          </p>
        </div>
        <a href={"/reports/vendor-performance/export?wReturn=" + wReturn + "&wRecon=" + wRecon + "&wScrap=" + wScrap + "&wQuality=" + wQuality} className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Export CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 text-right font-medium">Return Timeliness</th>
              <th className="px-3 py-2 text-right font-medium">Reconciliation</th>
              <th className="px-3 py-2 text-right font-medium">Scrap Recovery</th>
              <th className="px-3 py-2 text-right font-medium">Quality</th>
              <th className="px-3 py-2 text-right font-medium">Overall Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">No active vendors.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.vendorId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{r.vendorName}</div>
                    <div className="font-mono text-xs text-slate-400">{r.vendorCode}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.returnTimelinessScore)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.reconciliationScore)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.scrapRecoveryScore)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.qualityScore)}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={
                        r.overallScore === null
                          ? "text-slate-400"
                          : r.overallScore >= 90
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
                            : r.overallScore >= 70
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                              : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
                      }
                    >
                      {fmt(r.overallScore)}
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
