/**
 * OMS integration: read-only view of Delivery Challans for the separate OMS app.
 *
 * The OMS backend calls GET /api/integrations/oms/dcs server-to-server to learn which
 * DCs exist for its Work Orders (subcontracting "at vendor" / "expected back soon").
 * Everything here is pure (no Prisma client, no request objects) so it can be unit
 * tested; the route handler only does auth, runs the query and serialises the result.
 *
 * Only operational, non-personal, non-price columns are selected.
 */
import { createHash, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";

export const OMS_MAX_ROWS = 500;
export const OMS_MAX_WO_NUMBERS = 200;
export const OMS_DEFAULT_RETURN_DAYS = 15;

/** IST is a fixed UTC+05:30 offset (no DST), matching src/lib/dc-date.ts. */
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Status semantics for OMS:
 * - CANCELLED (or any DC with cancelledAt set) is treated as deleted: it never left, or
 *   was voided, so it is ALWAYS excluded. The schema has no other soft-delete column;
 *   draft deletion in this app is a hard delete.
 * - CLOSED and REJECTED are "finished": CLOSED is the end of the normal lifecycle (also
 *   what the app's dashboards treat as terminal alongside CANCELLED), and REJECTED is a
 *   terminal refusal at approval - such a DC is never dispatched again (rework uses
 *   SENT_BACK instead). A DC with closedAt set is also finished.
 *   These are excluded when openOnly=true (the default) and reported with closed=true
 *   when openOnly=false.
 * Every other status (DRAFT ... PAYMENT_APPROVED, HOLD, SENT_BACK, etc.) is "open" and
 * returned with its raw status string so OMS can decide what to display.
 */
export const OMS_DELETED_STATUSES = ["CANCELLED"] as const;
export const OMS_FINISHED_STATUSES = ["CLOSED", "REJECTED"] as const;

type DecimalLike = { toNumber(): number } | { toString(): string } | number | string;

export type OmsDcRow = {
  dcNumber: string;
  woNumber: string;
  partNumber: string | null;
  partNumberSnapshot: string | null;
  supplierNameSnapshot: string | null;
  status: string;
  purpose: string | null;
  rmQuantity: DecimalLike | null;
  outwardQtyRw: DecimalLike | null;
  rmUom: string | null;
  securityDispatchQuantity: DecimalLike | null;
  securityDispatchDate: Date | null;
  securityDispatchedAt: Date | null;
  dispatchedAt: Date | null;
  securityFgQuantity: DecimalLike | null;
  actualInwardQty: DecimalLike | null;
  storeReceivedQty: DecimalLike | null;
  storeVerifiedFgQuantity: DecimalLike | null;
  closedAt: Date | null;
  createdAt: Date;
  vendor: { vendorName: string; defaultReturnDays: number | null } | null;
  items: { quantity: DecimalLike; uom: string | null }[];
};

export type OmsDc = {
  dcNumber: string;
  woNumber: string;
  partNumber: string | null;
  vendorName: string | null;
  status: string;
  purpose: string | null;
  quantitySent: number | null;
  unit: string | null;
  sentAt: string | null;
  expectedReturnDate: string | null;
  quantityReturned: number | null;
  closed: boolean;
};

export type OmsDcResponse = { generatedAt: string; dcs: OmsDc[] };

/** Prisma `select` for OmsDcRow - keep in sync with the type above. */
export const OMS_DC_SELECT = {
  dcNumber: true,
  woNumber: true,
  partNumber: true,
  partNumberSnapshot: true,
  supplierNameSnapshot: true,
  status: true,
  purpose: true,
  rmQuantity: true,
  outwardQtyRw: true,
  rmUom: true,
  securityDispatchQuantity: true,
  securityDispatchDate: true,
  securityDispatchedAt: true,
  dispatchedAt: true,
  securityFgQuantity: true,
  actualInwardQty: true,
  storeReceivedQty: true,
  storeVerifiedFgQuantity: true,
  closedAt: true,
  createdAt: true,
  vendor: { select: { vendorName: true, defaultReturnDays: true } },
  items: { select: { quantity: true, uom: true } },
} satisfies Prisma.DeliveryChallanSelect;

/**
 * Timing-safe comparison of the presented token with the configured one. Both values
 * are SHA-256 hashed first so timingSafeEqual always gets equal-length buffers and the
 * token length is not leaked through an early return.
 */
export function isValidOmsToken(presented: string | null | undefined, expected: string): boolean {
  if (!presented || !expected) return false;
  const a = createHash("sha256").update(presented, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Collects `woNumber` values from repeated and/or comma-separated params; trimmed, de-duplicated, max 200. */
export function parseWoNumbers(values: string[]): string[] {
  const out = new Set<string>();
  for (const raw of values) {
    for (const part of raw.split(",")) {
      const v = part.trim();
      if (v) out.add(v);
      if (out.size >= OMS_MAX_WO_NUMBERS) return [...out];
    }
  }
  return [...out];
}

/** openOnly defaults to true; only an explicit "false"/"0"/"no" turns it off. */
export function parseOpenOnly(value: string | null): boolean {
  if (value == null) return true;
  return !["false", "0", "no"].includes(value.trim().toLowerCase());
}

export function buildOmsDcWhere(opts: { woNumbers: string[]; openOnly: boolean }): Prisma.DeliveryChallanWhereInput {
  const excluded: string[] = [...OMS_DELETED_STATUSES, ...(opts.openOnly ? OMS_FINISHED_STATUSES : [])];
  const where: Prisma.DeliveryChallanWhereInput = {
    status: { notIn: excluded as Prisma.EnumDcStatusFilter["notIn"] },
    cancelledAt: null,
  };
  if (opts.openOnly) where.closedAt = null;
  if (opts.woNumbers.length > 0) where.woNumber = { in: opts.woNumbers };
  return where;
}

export const OMS_DC_ORDER_BY: Prisma.DeliveryChallanOrderByWithRelationInput[] = [
  { securityDispatchedAt: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
];

/** Prisma Decimal / string / number -> finite number, else null. */
export function decimalToNumber(v: DecimalLike | null | undefined): number | null {
  if (v == null) return null;
  const n =
    typeof v === "number"
      ? v
      : typeof (v as { toNumber?: unknown }).toNumber === "function"
        ? (v as { toNumber(): number }).toNumber()
        : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Calendar date (YYYY-MM-DD) of an instant in Asia/Kolkata. */
export function toIstDateString(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Expected return = IST calendar day of sentAt + vendor.defaultReturnDays (15 when the
 * vendor is missing or has no/invalid value). Null when sentAt is unknown.
 */
export function computeExpectedReturnDate(sentAt: Date | null, returnDays: number | null | undefined): string | null {
  if (!sentAt) return null;
  const days = typeof returnDays === "number" && Number.isFinite(returnDays) && returnDays >= 0
    ? Math.floor(returnDays)
    : OMS_DEFAULT_RETURN_DAYS;
  const [y, m, d] = toIstDateString(sentAt).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export function mapDcForOms(dc: OmsDcRow): OmsDc {
  // sentAt: securityDispatchedAt is the timestamp written when Security physically
  // dispatches; securityDispatchDate (user-entered date) and dispatchedAt are fallbacks.
  const sentAtDate = dc.securityDispatchedAt ?? dc.securityDispatchDate ?? dc.dispatchedAt ?? null;

  // quantitySent: the quantity Security actually dispatched is the most reliable figure
  // (what physically left the gate). Before dispatch, fall back to the planned outward
  // quantity (outwardQtyRw, then rmQuantity - both in rmUom), and finally the sum of
  // line-item quantities for DCs created without header quantities.
  const itemSum = dc.items.length > 0
    ? dc.items.reduce<number | null>((acc, it) => {
        const q = decimalToNumber(it.quantity);
        return acc == null || q == null ? null : acc + q;
      }, 0)
    : null;
  const quantitySent =
    decimalToNumber(dc.securityDispatchQuantity) ??
    decimalToNumber(dc.outwardQtyRw) ??
    decimalToNumber(dc.rmQuantity) ??
    itemSum;

  // unit: the DC's RM UOM label; otherwise the items' UOM when all items share one.
  const itemUoms = [...new Set(dc.items.map((i) => i.uom).filter((u): u is string => !!u))];
  const unit = dc.rmUom || (itemUoms.length === 1 ? itemUoms[0] : null);

  // quantityReturned: most-verified figure first - Store-verified FG, then Store received,
  // then the Security inward (actualInwardQty / securityFgQuantity). Null if nothing returned yet.
  const quantityReturned =
    decimalToNumber(dc.storeVerifiedFgQuantity) ??
    decimalToNumber(dc.storeReceivedQty) ??
    decimalToNumber(dc.actualInwardQty) ??
    decimalToNumber(dc.securityFgQuantity);

  const status = String(dc.status);
  return {
    dcNumber: dc.dcNumber,
    woNumber: dc.woNumber,
    partNumber: dc.partNumber ?? dc.partNumberSnapshot ?? null,
    vendorName: dc.vendor?.vendorName ?? dc.supplierNameSnapshot ?? null,
    status,
    purpose: dc.purpose != null ? String(dc.purpose) : null,
    quantitySent,
    unit,
    sentAt: sentAtDate ? sentAtDate.toISOString() : null,
    expectedReturnDate: computeExpectedReturnDate(sentAtDate, dc.vendor?.defaultReturnDays),
    quantityReturned,
    closed: (OMS_FINISHED_STATUSES as readonly string[]).includes(status) || dc.closedAt != null,
  };
}

export function buildOmsDcResponse(rows: OmsDcRow[], now: Date = new Date()): OmsDcResponse {
  return { generatedAt: now.toISOString(), dcs: rows.map(mapDcForOms) };
}
