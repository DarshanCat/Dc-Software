import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getVendorPerformanceRows, parseWeight } from "@/server/reports/vendor-performance";

function csvEscape(v: string): string { return `"${v.replace(/"/g, '""')}"`; }

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const wReturn = parseWeight(sp.get("wReturn"), 25);
  const wRecon = parseWeight(sp.get("wRecon"), 25);
  const wScrap = parseWeight(sp.get("wScrap"), 25);
  const wQuality = parseWeight(sp.get("wQuality"), 25);

  const rows = await getVendorPerformanceRows({ wReturn, wRecon, wScrap, wQuality });
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