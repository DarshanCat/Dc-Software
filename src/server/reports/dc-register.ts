import { prisma } from "@/lib/db";
import type { Prisma, DcStatus, DcPurpose } from "@prisma/client";

export interface DcRegisterFilters {
  vendorId?: string;
  status?: string;
  purpose?: string;
  processId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface DcRegisterRow {
  dcId: string;
  dcNumber: string;
  dcDate: Date;
  vendorName: string;
  processName: string;
  itemLabel: string;
  quantity: number;
  weight: number;
  expectedReturnDate: Date | null;
  receivedQuantity: number;
  scrapWeight: number;
  balance: number;
  status: string;
}

export function buildDcRegisterWhere(filters: DcRegisterFilters): Prisma.DeliveryChallanWhereInput {
  const where: Prisma.DeliveryChallanWhereInput = {};
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.status) where.status = filters.status as DcStatus;
  if (filters.purpose) where.purpose = filters.purpose as DcPurpose;
  if (filters.processId) where.processId = filters.processId;
  if (filters.dateFrom || filters.dateTo) {
    where.dcDate = {};
    if (filters.dateFrom) where.dcDate.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.dcDate.lte = new Date(`${filters.dateTo}T23:59:59.999`);
  }
  return where;
}

export async function getDcRegisterRows(
  filters: DcRegisterFilters,
  pagination?: { skip: number; take: number },
): Promise<{ rows: DcRegisterRow[]; total: number }> {
  const where = buildDcRegisterWhere(filters);

  const [dcs, total] = await Promise.all([
    prisma.deliveryChallan.findMany({
      where,
      include: {
        vendor: true,
        process: true,
        items: { include: { item: true } },
        receipts: { include: { items: true } },
        scrapReceipts: { include: { items: true } },
      },
      orderBy: { dcDate: "desc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.deliveryChallan.count({ where }),
  ]);

  const rows: DcRegisterRow[] = dcs.map((dc) => {
    const firstItem = dc.items[0];
    const quantity = dc.items.reduce((s, it) => s + Number(it.quantity), 0);
    const weight = dc.items.reduce((s, it) => s + Number(it.inputWeight), 0);
    const receivedQuantity = dc.receipts.reduce(
      (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.quantityReceived), 0),
      0,
    );
    const scrapWeight = dc.scrapReceipts.reduce(
      (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
      0,
    );

    return {
      dcId: dc.id,
      dcNumber: dc.dcNumber,
      dcDate: dc.dcDate,
      vendorName: dc.vendor.vendorName,
      processName: dc.process?.name ?? "—",
      itemLabel: firstItem ? `${firstItem.item.itemCode} — ${firstItem.item.itemName}` : "—",
      quantity,
      weight,
      expectedReturnDate: dc.expectedReturnDate,
      receivedQuantity,
      scrapWeight,
      balance: Math.max(quantity - receivedQuantity, 0),
      status: dc.status,
    };
  });

  return { rows, total };
}

export function rowsToCsv(rows: DcRegisterRow[]): string {
  const header = [
    "DC No", "Date", "Vendor", "Process", "Item", "Qty", "Weight (kg)",
    "Expected Return", "Received Qty", "Scrap (kg)", "Balance", "Status",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escape(r.dcNumber),
        escape(r.dcDate.toISOString().slice(0, 10)),
        escape(r.vendorName),
        escape(r.processName),
        escape(r.itemLabel),
        String(r.quantity),
        r.weight.toFixed(3),
        r.expectedReturnDate ? escape(r.expectedReturnDate.toISOString().slice(0, 10)) : "",
        String(r.receivedQuantity),
        r.scrapWeight.toFixed(3),
        r.balance.toFixed(3),
        escape(r.status),
      ].join(","),
    );
  }
  return lines.join("\n");
}