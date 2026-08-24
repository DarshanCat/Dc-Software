import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";

export const dynamic = "force-dynamic";

const FULLY_RETURNED_ONWARD = ["MATERIAL_RETURNED", "SCRAP_PENDING", "RECONCILIATION", "RECONCILED", "CLOSED"];

interface SearchParams {
  itemId?: string;
}

export default async function ItemHistoryReportPage({
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

  const items = await prisma.item.findMany({ where: { active: true }, orderBy: { itemCode: "asc" } });

  if (!sp.itemId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Item History</h1>
          <p className="text-sm text-slate-500">Select an item to see its full DC history.</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {items.map((it) => (
              <Link
                key={it.id}
                href={"/reports/item-history?itemId=" + it.id}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <div className="font-mono text-xs text-slate-500">{it.itemCode}</div>
                <div className="text-slate-900">{it.itemName}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const item = await prisma.item.findUnique({ where: { id: sp.itemId } });
  if (!item) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">Item not found.</div>
    );
  }

  const dcItems = await prisma.deliveryChallanItem.findMany({
    where: { itemId: sp.itemId },
    include: {
      dc: {
        include: {
          vendor: true,
          dispatch: true,
          receipts: { include: { items: true } },
          scrapReceipts: { include: { items: true } },
        },
      },
    },
  });

  let totalSent = 0;
  let totalReturned = 0;
  let totalScrap = 0;
  let totalProcessLoss = 0;
  let openDcCount = 0;
  const vendorIds = new Set<string>();
  const returnDaysList: number[] = [];
  const dcRows: {
    dcId: string; dcNumber: string; vendorName: string; date: Date; status: string;
    quantity: number; weight: number;
  }[] = [];

  for (const dcItem of dcItems) {
    const dc = dcItem.dc;
    totalSent += Number(dcItem.inputWeight);
    totalProcessLoss += Number(dcItem.expectedProcessLoss);
    vendorIds.add(dc.vendorId);
    if (dc.status !== "CLOSED" && dc.status !== "CANCELLED") openDcCount++;

    const returnedNet = dc.receipts.reduce(
      (sum, r) => sum + r.items.reduce((s, l) => s + (Number(l.weightReceived) - Number(l.rejectedWeight)), 0),
      0,
    );
    const scrap = dc.scrapReceipts.reduce(
      (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
      0,
    );
    totalReturned += returnedNet;
    totalScrap += scrap;

    if (FULLY_RETURNED_ONWARD.includes(dc.status) && dc.dispatch && dc.receipts.length > 0) {
      const lastReceipt = [...dc.receipts].sort((a, b) => b.receiptDate.getTime() - a.receiptDate.getTime())[0];
      const days = (lastReceipt.receiptDate.getTime() - dc.dispatch.dispatchedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0) returnDaysList.push(days);
    }

    dcRows.push({
      dcId: dc.id,
      dcNumber: dc.dcNumber,
      vendorName: dc.vendor.vendorName,
      date: dc.dcDate,
      status: dc.status,
      quantity: Number(dcItem.quantity),
      weight: Number(dcItem.inputWeight),
    });
  }

  dcRows.sort((a, b) => b.date.getTime() - a.date.getTime());
  const avgScrapPercent = totalSent > 0 ? (totalScrap / totalSent) * 100 : null;
  const avgReturnDays =
    returnDaysList.length > 0 ? returnDaysList.reduce((a, b) => a + b, 0) / returnDaysList.length : null;

  const kpis = [
    { label: "Total Sent", value: totalSent.toFixed(3) + " kg" },
    { label: "Total Returned", value: totalReturned.toFixed(3) + " kg" },
    { label: "Total Scrap", value: totalScrap.toFixed(3) + " kg" },
    { label: "Avg Scrap %", value: avgScrapPercent === null ? "N/A" : avgScrapPercent.toFixed(1) + "%" },
    { label: "Total Process Loss", value: totalProcessLoss.toFixed(3) + " kg" },
    { label: "Avg Return Days", value: avgReturnDays === null ? "-" : avgReturnDays.toFixed(1) },
    { label: "Vendors Used", value: String(vendorIds.size) },
    { label: "Open DCs", value: String(openDcCount) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{item.itemCode} - {item.itemName}</h1>
          <p className="text-sm text-slate-500">{dcItems.length} DC line(s) in history</p>
        </div>
        <div className="flex gap-2">
          <a href={"/reports/item-history/export?itemId=" + item.id} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Export CSV
          </a>
          <Link href="/reports/item-history" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Choose Different Item
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">{k.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC No</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Weight</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dcRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">No DC history for this item yet.</td>
              </tr>
            ) : (
              dcRows.map((r) => (
                <tr key={r.dcId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={"/dcs/" + r.dcId} className="font-mono text-blue-700 hover:underline">{r.dcNumber}</Link>
                  </td>
                  <td className="px-3 py-2 text-slate-900">{r.vendorName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.date.toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.weight.toFixed(3)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{r.status.replace(/_/g, " ")}</span>
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
