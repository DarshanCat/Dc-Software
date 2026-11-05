import { prisma } from "@/lib/db";
import { sanitizeCsvCell } from "@/lib/csv";
import type { DcStatus } from "@prisma/client";

/**
 * A Tool DC's tool instances count as "with the vendor" once they have
 * physically left the gate (DISPATCHED) and until they are returned
 * (SECURITY_RETURNED or beyond) - mirrors the Security dispatch/return queue
 * convention used elsewhere (src/server/dcs/queries.ts).
 */
const WITH_VENDOR_STATUSES: DcStatus[] = ["DISPATCHED", "AT_VENDOR"];

export interface ToolTrackingFilters {
  vendorId?: string | null;
}

export interface ToolTrackingRow {
  dcId: string;
  dcNumber: string;
  dcDate: Date;
  vendorId: string | null;
  vendorName: string;
  toolCode: string;
  toolName: string;
  serialNumber: string;
  quantity: number;
  uom: string;
  conditionOut: string | null;
  dispatchedAt: Date | null;
  expectedReturnDate: Date | null;
  status: string;
  daysOut: number | null;
}

export async function getToolsWithVendor(filters: ToolTrackingFilters = {}): Promise<ToolTrackingRow[]> {
  const dcs = await prisma.deliveryChallan.findMany({
    where: {
      movementType: "TOOL",
      status: { in: WITH_VENDOR_STATUSES },
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    },
    include: { vendor: true, items: true },
    orderBy: { securityDispatchedAt: "desc" },
  });

  const toolInstanceIds = [
    ...new Set(dcs.flatMap((dc) => dc.items.map((i) => i.toolInstanceId)).filter((v): v is string => !!v)),
  ];
  const toolInstances = await prisma.toolInstance.findMany({
    where: { id: { in: toolInstanceIds } },
    include: { toolMaster: true },
  });
  const toolInstanceMap = new Map(toolInstances.map((ti) => [ti.id, ti]));

  const now = Date.now();
  const rows: ToolTrackingRow[] = [];

  for (const dc of dcs) {
    const dispatchedAt = dc.securityDispatchedAt ?? dc.outwardDate ?? null;
    for (const item of dc.items) {
      // Only items tracked against a specific ToolInstance count as identifiable
      // tools out with the vendor - a line item with no toolInstanceId (e.g. a
      // generic consumable on a TOOL DC) can't be attributed to a serial number.
      if (!item.toolInstanceId) continue;
      const toolInstance = toolInstanceMap.get(item.toolInstanceId);
      rows.push({
        dcId: dc.id,
        dcNumber: dc.dcNumber,
        dcDate: dc.dcDate,
        vendorId: dc.vendorId,
        vendorName: dc.vendor?.vendorName || dc.supplierNameSnapshot || "—",
        toolCode: toolInstance?.toolMaster?.toolCode || item.itemCode || "—",
        toolName: toolInstance?.toolMaster?.toolName || item.itemDescription,
        serialNumber: toolInstance?.serialNumber || "—",
        quantity: Number(item.quantity),
        uom: item.uom,
        conditionOut: item.conditionIn,
        dispatchedAt,
        expectedReturnDate: dc.expectedReturnDate,
        status: dc.status,
        daysOut: dispatchedAt ? Math.floor((now - dispatchedAt.getTime()) / 86_400_000) : null,
      });
    }
  }

  return rows;
}

export interface ToolCountByVendor {
  vendorId: string | null;
  vendorName: string;
  toolCount: number;
}

export function summarizeByVendor(rows: ToolTrackingRow[]): ToolCountByVendor[] {
  const byVendor = new Map<string, ToolCountByVendor>();
  for (const row of rows) {
    const key = row.vendorId ?? row.vendorName;
    const existing = byVendor.get(key);
    if (existing) {
      existing.toolCount += row.quantity;
    } else {
      byVendor.set(key, { vendorId: row.vendorId, vendorName: row.vendorName, toolCount: row.quantity });
    }
  }
  return [...byVendor.values()].sort((a, b) => b.toolCount - a.toolCount);
}

export function toolTrackingRowsToCsv(rows: ToolTrackingRow[]): string {
  const header = [
    "DC Number", "DC Date", "Vendor", "Tool Code", "Tool Name", "Serial Number",
    "Qty", "UOM", "Condition At Dispatch", "Dispatched At", "Expected Return", "Status", "Days Out",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        sanitizeCsvCell(r.dcNumber),
        sanitizeCsvCell(r.dcDate.toLocaleDateString()),
        sanitizeCsvCell(r.vendorName),
        sanitizeCsvCell(r.toolCode),
        sanitizeCsvCell(r.toolName),
        sanitizeCsvCell(r.serialNumber),
        String(r.quantity),
        sanitizeCsvCell(r.uom),
        sanitizeCsvCell(r.conditionOut || "—"),
        sanitizeCsvCell(r.dispatchedAt ? r.dispatchedAt.toLocaleDateString() : "—"),
        sanitizeCsvCell(r.expectedReturnDate ? r.expectedReturnDate.toLocaleDateString() : "—"),
        sanitizeCsvCell(r.status),
        r.daysOut === null ? '""' : String(r.daysOut),
      ].join(","),
    );
  }
  return lines.join("\n");
}
