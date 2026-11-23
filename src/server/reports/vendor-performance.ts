import { prisma } from "@/lib/db";

/**
 * A DC only counts toward Return Timeliness once it has actually completed the
 * outbound/return lifecycle - reached one of these statuses AND was actually
 * dispatched (has a `dispatch` record or `dispatchedAt` / `securityDispatchDate`).
 * A DC that merely has a stray receipt while still mid-pipeline (e.g. DRAFT,
 * PENDING_APPROVAL) must not count.
 */
const FULLY_RETURNED_ONWARD = [
  "SECURITY_RETURNED",
  "STORE_VERIFIED",
  "STORE_CONFIRMED",
  "CUSTODIAN_VERIFIED",
  "QUALITY_COMPLETED",
  "FINAL_APPROVED",
  "APPROVED_FOR_PAYMENT",
  "PAYMENT_APPROVED",
  "CLOSED",
  "PARTIALLY_RETURNED",
  "MATERIAL_RETURNED",
  "SCRAP_PENDING",
  "RECONCILIATION",
  "RECONCILED",
];

export interface VendorPerformanceWeights {
  wReturn: number;
  wRecon: number;
  wScrap: number;
  wQuality: number;
}

export interface VendorPerformanceRow {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  returnTimelinessScore: number | null;
  reconciliationScore: number | null;
  scrapRecoveryScore: number | null;
  qualityScore: number | null;
  overallScore: number | null;
}

export function parseWeight(v: string | null | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Single source of truth for Vendor Performance scoring, shared by the report
 * page and its CSV export so the two can never show different numbers for the
 * same vendor/weights.
 */
export async function getVendorPerformanceRows(weights: VendorPerformanceWeights): Promise<VendorPerformanceRow[]> {
  const { wReturn, wRecon, wScrap, wQuality } = weights;

  const vendors = await prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" } });

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      vendor: true,
      dispatch: true,
      reconciliation: true,
      receipts: { include: { items: true } },
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

  const rows = vendors.map((vendor) => {
    const vendorDcs = dcsByVendor.get(vendor.id) ?? [];

    let timelinessEligible = 0;
    let timelyCount = 0;
    let reconciledEligible = 0;
    let balancedCount = 0;
    let totalExpectedScrap = 0;
    let totalReceivedScrap = 0;
    let totalGrossReceived = 0;
    let totalRejected = 0;

    for (const dc of vendorDcs) {
      const isDispatched = !!(dc.dispatch || dc.dispatchedAt || dc.securityDispatchDate);
      const lastReceipt = dc.receipts && dc.receipts.length > 0
        ? [...dc.receipts].sort((a, b) => b.receiptDate.getTime() - a.receiptDate.getTime())[0]
        : null;
      const returnDate = dc.inwardDate || dc.securityReturnDate || (lastReceipt ? lastReceipt.receiptDate : null);
      const isReturned = FULLY_RETURNED_ONWARD.includes(dc.status) || !!(returnDate || dc.actualInwardQty);

      // Return Timeliness
      const expDate = dc.expectedReturnDate || (dc.dispatchedAt ? new Date(dc.dispatchedAt.getTime() + 15 * 86400000) : (dc.dcDate ? new Date(dc.dcDate.getTime() + 15 * 86400000) : null));
      if (isDispatched && isReturned && expDate && returnDate) {
        timelinessEligible++;
        if (returnDate <= expDate) timelyCount++;
      }

      // Reconciliation / Fulfillment
      if (dc.reconciliation) {
        reconciledEligible++;
        if (dc.reconciliation.status === "BALANCED" || dc.reconciliation.status === "CLOSED") balancedCount++;
      } else if (isReturned) {
        const expFg = Number(dc.returnFgQuantity ?? dc.rmQuantity ?? 0);
        const actIn = Number(dc.actualInwardQty ?? dc.storeReceivedQty ?? dc.securityFgQuantity ?? 0);
        if (expFg > 0 && actIn > 0) {
          reconciledEligible++;
          if (actIn >= expFg || dc.status === "APPROVED_FOR_PAYMENT" || dc.status === "CLOSED") {
            balancedCount++;
          }
        }
      }

      // Scrap Recovery
      const expScrap = Number(dc.expectedScrap ?? 0) + Number(dc.returnGatingQty ?? 0);
      const recScrap = Number(dc.storeGatingWeight ?? 0) + Number(dc.storeBoringWeight ?? 0) +
        Number(dc.storeVerifiedScrapQuantity ?? dc.scrapQty ?? dc.finalApprovedScrapQuantity ?? dc.securityScrapQuantity ?? 0) +
        (dc.scrapReceipts ? dc.scrapReceipts.reduce((sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0), 0) : 0);

      totalExpectedScrap += expScrap;
      totalReceivedScrap += recScrap;

      // Quality: direct from DC quality inspection fields
      const good = Number(dc.goodQty ?? 0);
      const rej = Number(dc.rejectionQty ?? 0);
      const scrap = Number(dc.scrapQty ?? 0);
      const totalQ = good + rej + scrap;
      if (totalQ > 0) {
        totalGrossReceived += totalQ;
        totalRejected += rej;
      }

      // Plus any legacy receipts
      if (dc.receipts) {
        for (const receipt of dc.receipts) {
          for (const line of receipt.items) {
            totalGrossReceived += Number(line.weightReceived);
            totalRejected += Number(line.rejectedWeight);
          }
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

    const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
    const overallScore = parts.length > 0 && totalWeight > 0
      ? parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight
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
  return rows;
}
