import { prisma } from "@/lib/db";
import { StatusDistributionChart, VendorOutstandingChart, OverdueAgeingChart } from "./dashboard-charts";

const TERMINAL_STATUSES = ["CLOSED", "CANCELLED"];
const DISPATCHED_ONWARD = [
  "DISPATCHED", "AT_VENDOR", "PARTIALLY_RETURNED", "MATERIAL_RETURNED",
  "SCRAP_PENDING", "RECONCILIATION", "RECONCILED",
];
const SCRAP_PENDING_STATUSES = ["MATERIAL_RETURNED", "SCRAP_PENDING"];

function ageingBucket(days: number): string {
  if (days <= 7) return "0-7 Days";
  if (days <= 15) return "8-15 Days";
  if (days <= 30) return "16-30 Days";
  if (days <= 60) return "31-60 Days";
  return "60+ Days";
}

export default async function DashboardPage() {
  const now = new Date();

  const [statusGroups, exceptionOpenCount, dcs] = await Promise.all([
    prisma.deliveryChallan.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.exception.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "REJECTED"] } } }),
    prisma.deliveryChallan.findMany({
      where: { status: { notIn: TERMINAL_STATUSES } },
      include: {
        vendor: true,
        items: true,
        receipts: { include: { items: true } },
        scrapReceipts: { include: { items: true } },
      },
    }),
  ]);

  let openDcCount = 0;
  let overdueCount = 0;
  let materialOutsideKg = 0;
  let finishedPendingKg = 0;
  let scrapPendingKg = 0;
  const vendorOutstanding = new Map<string, number>();
  const ageingCounts = new Map<string, number>();

  for (const dc of dcs) {
    openDcCount++;

    const isOverdue = dc.expectedReturnDate !== null && dc.expectedReturnDate < now;
    if (isOverdue) {
      overdueCount++;
      const days = Math.floor((now.getTime() - dc.expectedReturnDate!.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = ageingBucket(days);
      ageingCounts.set(bucket, (ageingCounts.get(bucket) ?? 0) + 1);
    }

    if (DISPATCHED_ONWARD.includes(dc.status)) {
      const totalInput = dc.items.reduce((s, it) => s + Number(it.inputWeight), 0);
      const totalReceivedNet = dc.receipts.reduce(
        (sum, r) => sum + r.items.reduce((s, l) => s + (Number(l.weightReceived) - Number(l.rejectedWeight)), 0),
        0,
      );
      const outstanding = Math.max(totalInput - totalReceivedNet, 0);
      materialOutsideKg += outstanding;
      finishedPendingKg += outstanding;

      if (outstanding > 0) {
        const vendorName = dc.vendor.vendorName;
        vendorOutstanding.set(vendorName, (vendorOutstanding.get(vendorName) ?? 0) + outstanding);
      }
    }

    if (SCRAP_PENDING_STATUSES.includes(dc.status)) {
      const expectedScrap = dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
      const receivedScrap = dc.scrapReceipts.reduce(
        (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
        0,
      );
      scrapPendingKg += Math.max(expectedScrap - receivedScrap, 0);
    }
  }

  const allNonCancelled = await prisma.deliveryChallan.findMany({
    where: { status: { not: "CANCELLED" } },
    include: { items: true, scrapReceipts: { include: { items: true } } },
  });
  let totalExpectedScrap = 0;
  let totalReceivedScrap = 0;
  for (const dc of allNonCancelled) {
    totalExpectedScrap += dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
    totalReceivedScrap += dc.scrapReceipts.reduce(
      (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
      0,
    );
  }
  const scrapRecoveryPercent = totalExpectedScrap > 0 ? (totalReceivedScrap / totalExpectedScrap) * 100 : null;

  const statusData = statusGroups
    .map((g) => ({ status: g.status.replace(/_/g, " "), count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const vendorData = Array.from(vendorOutstanding.entries())
    .map(([vendor, kg]) => ({ vendor, kg: Number(kg.toFixed(1)) }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 8);

  const ageingOrder = ["0-7 Days", "8-15 Days", "16-30 Days", "31-60 Days", "60+ Days"];
  const ageingData = ageingOrder.map((bucket) => ({ bucket, count: ageingCounts.get(bucket) ?? 0 }));

  const kpis = [
    { label: "Total Open DCs", value: openDcCount.toString() },
    { label: "Overdue DCs", value: overdueCount.toString() },
    { label: "Material Outside", value: `${materialOutsideKg.toFixed(1)} kg` },
    { label: "Finished Material Pending", value: `${finishedPendingKg.toFixed(1)} kg` },
    { label: "Scrap Pending", value: `${scrapPendingKg.toFixed(1)} kg` },
    { label: "Scrap Recovery %", value: scrapRecoveryPercent === null ? "N/A" : `${scrapRecoveryPercent.toFixed(1)}%` },
    { label: "Reconciliation Exceptions", value: exceptionOpenCount.toString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Live figures from the database — updates as DCs move through their lifecycle.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">DC Status Distribution</h2>
          {statusData.length === 0 ? (
            <p className="text-sm text-slate-400">No DCs yet.</p>
          ) : (
            <StatusDistributionChart data={statusData} />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Vendor-wise Outstanding</h2>
          {vendorData.length === 0 ? (
            <p className="text-sm text-slate-400">No material currently outstanding at any vendor.</p>
          ) : (
            <VendorOutstandingChart data={vendorData} />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Overdue Ageing</h2>
          {overdueCount === 0 ? (
            <p className="text-sm text-slate-400">No overdue DCs right now.</p>
          ) : (
            <OverdueAgeingChart data={ageingData} />
          )}
        </div>
      </div>
    </div>
  );
}