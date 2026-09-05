import { prisma } from "@/lib/db";

const DISPATCHED_ONWARD = [
  "DISPATCHED", "AT_VENDOR", "PARTIALLY_RETURNED", "MATERIAL_RETURNED",
  "SCRAP_PENDING", "RECONCILIATION", "RECONCILED",
];
const SCRAP_PENDING_STATUSES = ["MATERIAL_RETURNED", "SCRAP_PENDING"];
const FULLY_RETURNED_ONWARD = ["MATERIAL_RETURNED", "SCRAP_PENDING", "RECONCILIATION", "RECONCILED", "CLOSED"];

export interface VendorOutstandingRow {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  openDcCount: number;
  materialOutsideKg: number;
  finishedPendingKg: number;
  scrapPendingKg: number;
  overdueDcCount: number;
  avgReturnDays: number | null;
  scrapRecoveryPercent: number | null;
}

export async function getVendorOutstandingRows(): Promise<VendorOutstandingRow[]> {
  const now = new Date();

  const vendors = await prisma.vendor.findMany({
    where: { active: true },
    orderBy: { vendorName: "asc" },
  });

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      dispatch: true,
      receipts: { include: { items: true }, orderBy: { receiptDate: "desc" } },
      scrapReceipts: { include: { items: true } },
    },
  });

  const dcsByVendor = new Map<string, typeof dcs>();
  for (const dc of dcs) {
    if (!dc.vendorId) continue;
    const list = dcsByVendor.get(dc.vendorId) ?? [];
    list.push(dc);
    dcsByVendor.set(dc.vendorId, list);
  }

  return vendors.map((vendor) => {
    const vendorDcs = dcsByVendor.get(vendor.id) ?? [];

    let openDcCount = 0;
    let materialOutsideKg = 0;
    let scrapPendingKg = 0;
    let overdueDcCount = 0;
    let totalExpectedScrap = 0;
    let totalReceivedScrap = 0;
    const returnDaysList: number[] = [];

    for (const dc of vendorDcs) {
      if (dc.status !== "CLOSED") openDcCount++;

      const isOverdue = dc.expectedReturnDate !== null && dc.expectedReturnDate < now && dc.status !== "CLOSED";
      if (isOverdue) overdueDcCount++;

      if (DISPATCHED_ONWARD.includes(dc.status)) {
        const totalInput = Number(dc.rmQuantity ?? 0);
        const totalReceivedNet = dc.receipts.reduce(
          (sum, r) => sum + r.items.reduce((s, l) => s + (Number(l.weightReceived) - Number(l.rejectedWeight)), 0),
          0,
        );
        materialOutsideKg += Math.max(totalInput - totalReceivedNet, 0);
      }

      if (SCRAP_PENDING_STATUSES.includes(dc.status)) {
        const expectedScrap = Number(dc.expectedScrap ?? 0);
        const receivedScrap = dc.scrapReceipts.reduce(
          (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
          0,
        );
        scrapPendingKg += Math.max(expectedScrap - receivedScrap, 0);
      }

      const expectedScrapAll = Number(dc.expectedScrap ?? 0);
      totalExpectedScrap += expectedScrapAll;
      totalReceivedScrap += dc.scrapReceipts.reduce(
        (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
        0,
      );

      if (FULLY_RETURNED_ONWARD.includes(dc.status) && dc.dispatch && dc.receipts.length > 0) {
        const lastReceiptDate = dc.receipts[0].receiptDate;
        const days = (lastReceiptDate.getTime() - dc.dispatch.dispatchedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) returnDaysList.push(days);
      }
    }

    const avgReturnDays =
      returnDaysList.length > 0 ? returnDaysList.reduce((a, b) => a + b, 0) / returnDaysList.length : null;
    const scrapRecoveryPercent = totalExpectedScrap > 0 ? (totalReceivedScrap / totalExpectedScrap) * 100 : null;

    return {
      vendorId: vendor.id,
      vendorCode: vendor.vendorCode,
      vendorName: vendor.vendorName,
      openDcCount,
      materialOutsideKg,
      finishedPendingKg: materialOutsideKg,
      scrapPendingKg,
      overdueDcCount,
      avgReturnDays,
      scrapRecoveryPercent,
    };
  });
}

import { sanitizeCsvCell } from "@/lib/csv";

export function vendorRowsToCsv(rows: VendorOutstandingRow[]): string {
  const header = [
    "Vendor Code", "Vendor Name", "Open DCs", "Material Outside (kg)",
    "Finished Pending (kg)", "Scrap Pending (kg)", "Overdue DCs", "Avg Return Days", "Scrap Recovery %",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        sanitizeCsvCell(r.vendorCode),
        sanitizeCsvCell(r.vendorName),
        String(r.openDcCount),
        r.materialOutsideKg.toFixed(3),
        r.finishedPendingKg.toFixed(3),
        r.scrapPendingKg.toFixed(3),
        String(r.overdueDcCount),
        r.avgReturnDays === null ? '""' : r.avgReturnDays.toFixed(1),
        r.scrapRecoveryPercent === null ? '""' : r.scrapRecoveryPercent.toFixed(1),
      ].join(","),
    );
  }
  return lines.join("\n");
}