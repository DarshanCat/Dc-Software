import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";

const FULLY_RETURNED_ONWARD = ["MATERIAL_RETURNED", "SCRAP_PENDING", "RECONCILIATION", "RECONCILED", "CLOSED"];

function num(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function csvEscape(v: string): string { return `"${v.replace(/"/g, '""')}"`; }

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const wReturn = num(sp.get("wReturn"), 25);
  const wRecon = num(sp.get("wRecon"), 25);
  const wScrap = num(sp.get("wScrap"), 25);
  const wQuality = num(sp.get("wQuality"), 25);

  const vendors = await prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" } });
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      vendor: true, dispatch: true, reconciliation: true,
      receipts: { include: { items: true } }, scrapReceipts: { include: { items: true } },
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
    let timelyCount = 0, timelinessEligible = 0, balancedCount = 0, reconciledEligible = 0;
    let totalExpectedScrap = 0, totalReceivedScrap = 0, totalGrossReceived = 0, totalRejected = 0;

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
      totalReceivedScrap += dc.scrapReceipts.reduce((sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0), 0);
      for (const receipt of dc.receipts) {
        for (const line of receipt.items) {
          totalGrossReceived += Number(line.weightReceived);
          totalRejected += Number(line.rejectedWeight);
        }
      }
    }

    const returnTimelinessScore = timelinessEligible > 0 ? (timelyCount / timelinessEligible) * 100 : null;
    const reconciliationScore = reconciledEligible > 0 ? (balancedCount / reconciledEligible) * 100 : null;
    const scrapRecoveryScore = totalExpectedScrap > 0 ? Math.min((totalReceivedScrap / totalExpectedScrap) * 100, 100) : null;
    const qualityScore = totalGrossReceived > 0 ? Math.max(0, 100 - (totalRejected / totalGrossReceived) * 100) : null;

    const parts: { score: number; weight: number }[] = [];
    if (returnTimelinessScore !== null) parts.push({ score: returnTimelinessScore, weight: wReturn });
    if (reconciliationScore !== null) parts.push({ score: reconciliationScore, weight: wRecon });
    if (scrapRecoveryScore !== null) parts.push({ score: scrapRecoveryScore, weight: wScrap });
    if (qualityScore !== null) parts.push({ score: qualityScore, weight: wQuality });
    const overallScore = parts.length > 0
      ? parts.reduce((sum, p) => sum + p.score * p.weight, 0) / parts.reduce((sum, p) => sum + p.weight, 0)
      : null;

    return { vendorCode: vendor.vendorCode, vendorName: vendor.vendorName, returnTimelinessScore, reconciliationScore, scrapRecoveryScore, qualityScore, overallScore };
  });

  rows.sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1));
  const fmt = (v: number | null) => (v === null ? "N/A" : v.toFixed(1));

  const header = ["Vendor Code", "Vendor Name", "Return Timeliness %", "Reconciliation %", "Scrap Recovery %", "Quality %", "Overall Score"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      csvEscape(r.vendorCode), csvEscape(r.vendorName),
      fmt(r.returnTimelinessScore), fmt(r.reconciliationScore), fmt(r.scrapRecoveryScore), fmt(r.qualityScore), fmt(r.overallScore),
    ].join(","));
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendor-performance-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}