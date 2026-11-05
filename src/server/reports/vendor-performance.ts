import { prisma } from "@/lib/db";

/**
 * A DC only counts toward Return Timeliness once it has actually completed the
 * outbound/return lifecycle - reached one of these statuses AND was actually
 * dispatched (has a `dispatch` record). A DC that merely has a stray receipt
 * while still mid-pipeline (e.g. DRAFT, PENDING_APPROVAL) must not count.
 */
const FULLY_RETURNED_ONWARD = ["MATERIAL_RETURNED", "SCRAP_PENDING", "RECONCILIATION", "RECONCILED", "CLOSED"];

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
      if (FULLY_RETURNED_ONWARD.includes(dc.status) && dc.dispatch && dc.expectedReturnDate && dc.receipts.length > 0) {
        timelinessEligible++;
        const lastReceipt = [...dc.receipts].sort((a, b) => b.receiptDate.getTime() - a.receiptDate.getTime())[0];
        if (lastReceipt.receiptDate <= dc.expectedReturnDate) timelyCount++;
      }

      if (dc.reconciliation) {
        reconciledEligible++;
        if (dc.reconciliation.status === "BALANCED" || dc.reconciliation.status === "CLOSED") balancedCount++;
      }

      totalExpectedScrap += Number(dc.expectedScrap ?? 0);
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
  return rows;
}
