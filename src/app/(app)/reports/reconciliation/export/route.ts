import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status") || undefined;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const reconciliations = await prisma.reconciliation.findMany({
    where,
    include: {
      dc: { include: { vendor: true, exceptions: { orderBy: { createdAt: "asc" } } } },
    },
    orderBy: { calculatedAt: "desc" },
  });

  const openExceptionCount = (exceptions: { status: string }[]) =>
    exceptions.filter((e) => ["OPEN", "UNDER_REVIEW", "REJECTED"].includes(e.status)).length;

  const header = ["DC No", "Vendor", "Input (kg)", "Accounted (kg)", "Unaccounted (kg)", "Status", "Open Exceptions", "Calculated At"];
  const lines = [header.join(",")];
  for (const r of reconciliations) {
    lines.push([
      csvEscape(r.dc.dcNumber),
      csvEscape(r.dc.vendor.vendorName),
      Number(r.totalInputWeight).toFixed(3),
      Number(r.accountedWeight).toFixed(3),
      Number(r.unaccountedWeight).toFixed(3),
      csvEscape(r.status),
      String(openExceptionCount(r.dc.exceptions)),
      r.calculatedAt ? csvEscape(r.calculatedAt.toISOString()) : "",
    ].join(","));
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reconciliation-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}