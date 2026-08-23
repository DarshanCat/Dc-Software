import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import type { DcStatus } from "@prisma/client";

const TERMINAL_STATUSES: DcStatus[] = ["CLOSED", "CANCELLED"];

function ageingBucket(days: number): string {
  if (days <= 7) return "0-7 Days";
  if (days <= 15) return "8-15 Days";
  if (days <= 30) return "16-30 Days";
  if (days <= 60) return "31-60 Days";
  return "60+ Days";
}
function csvEscape(v: string): string { return `"${v.replace(/"/g, '""')}"`; }

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });

  const basis = request.nextUrl.searchParams.get("basis") === "overdue" ? "overdue" : "dispatch";
  const now = new Date();

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { notIn: TERMINAL_STATUSES } },
    include: { vendor: true, dispatch: true },
    orderBy: { dcDate: "desc" },
  });

  interface Row { dcNumber: string; vendorName: string; status: string; referenceDate: Date; days: number; bucket: string; }
  const rows: Row[] = [];
  for (const dc of dcs) {
    if (basis === "dispatch") {
      if (!dc.dispatch) continue;
      const days = Math.floor((now.getTime() - dc.dispatch.dispatchedAt.getTime()) / 86400000);
      rows.push({ dcNumber: dc.dcNumber, vendorName: dc.vendor.vendorName, status: dc.status, referenceDate: dc.dispatch.dispatchedAt, days, bucket: ageingBucket(days) });
    } else {
      if (!dc.expectedReturnDate || dc.expectedReturnDate >= now) continue;
      const days = Math.floor((now.getTime() - dc.expectedReturnDate.getTime()) / 86400000);
      rows.push({ dcNumber: dc.dcNumber, vendorName: dc.vendor.vendorName, status: dc.status, referenceDate: dc.expectedReturnDate, days, bucket: ageingBucket(days) });
    }
  }
  rows.sort((a, b) => b.days - a.days);

  const header = ["DC No", "Vendor", basis === "dispatch" ? "Dispatched On" : "Expected Return", "Days", "Bucket", "Status"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([csvEscape(r.dcNumber), csvEscape(r.vendorName), csvEscape(r.referenceDate.toISOString().slice(0, 10)), String(r.days), csvEscape(r.bucket), csvEscape(r.status)].join(","));
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ageing-${basis}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}