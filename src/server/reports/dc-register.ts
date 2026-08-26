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
  partNumber: string;
  rmQuantity: number;
  returnFgQuantity: number;
  heatNumber: string;
  expectedScrap: number;
  vendorName: string;
  processName: string;
  ewayBillNumber: string;
  eSugamNumber: string;
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
        receipts: { include: { items: true } },
        scrapReceipts: { include: { items: true } },
      },
      orderBy: { dcDate: "desc" },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    }),
    prisma.deliveryChallan.count({ where }),
  ]);

  const rows: DcRegisterRow[] = dcs.map((dc) => {
    const rmQty = dc.rmQuantity != null ? Number(dc.rmQuantity) : 0;
    const returnFgQty = dc.returnFgQuantity != null ? Number(dc.returnFgQuantity) : 0;
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
      partNumber: dc.partNumber ?? "—",
      rmQuantity: rmQty,
      returnFgQuantity: returnFgQty,
      heatNumber: dc.heatNumber ?? "—",
      expectedScrap: dc.expectedScrap != null ? Number(dc.expectedScrap) : 0,
      vendorName: dc.vendor.vendorName,
      processName: dc.process?.name ?? "—",
      ewayBillNumber: dc.ewayBillNumber ?? "—",
      eSugamNumber: dc.eSugamNumber ?? "—",
      expectedReturnDate: dc.expectedReturnDate,
      receivedQuantity,
      scrapWeight,
      balance: Math.max(returnFgQty - receivedQuantity, 0),
      status: dc.status,
    };
  });

  return { rows, total };
}

import { sanitizeCsvCell } from "@/lib/csv";

export function rowsToCsv(rows: DcRegisterRow[]): string {
  const header = [
    "DC No", "Date", "Part Number", "RM Qty", "Return FG Qty", "Heat Number", "Vendor", "Process",
    "E-Way Bill", "E-Sugam", "Expected Return", "Received Qty", "Actual Scrap (kg)", "Balance", "Status",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        sanitizeCsvCell(r.dcNumber),
        sanitizeCsvCell(r.dcDate.toISOString().slice(0, 10)),
        sanitizeCsvCell(r.partNumber),
        r.rmQuantity.toFixed(3),
        r.returnFgQuantity.toFixed(3),
        sanitizeCsvCell(r.heatNumber),
        sanitizeCsvCell(r.vendorName),
        sanitizeCsvCell(r.processName),
        sanitizeCsvCell(r.ewayBillNumber),
        sanitizeCsvCell(r.eSugamNumber),
        r.expectedReturnDate ? sanitizeCsvCell(r.expectedReturnDate.toISOString().slice(0, 10)) : '""',
        String(r.receivedQuantity),
        r.scrapWeight.toFixed(3),
        r.balance.toFixed(3),
        sanitizeCsvCell(r.status),
      ].join(","),
    );
  }
  return lines.join("\n");
}