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

  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId is required." }, { status: 400 });

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const dcItems = await prisma.deliveryChallanItem.findMany({
    where: { itemId },
    include: { dc: { include: { vendor: true } } },
  });

  const rows = dcItems
    .map((dcItem) => ({
      dcNumber: dcItem.dc.dcNumber,
      vendorName: dcItem.dc.vendor.vendorName,
      date: dcItem.dc.dcDate,
      quantity: Number(dcItem.quantity),
      weight: Number(dcItem.inputWeight),
      status: dcItem.dc.status,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const header = ["DC No", "Vendor", "Date", "Qty", "Weight (kg)", "Status"];
  const lines = [`Item: ${item.itemCode} - ${item.itemName}`, header.join(",")];
  for (const r of rows) {
    lines.push([
      csvEscape(r.dcNumber),
      csvEscape(r.vendorName),
      csvEscape(r.date.toISOString().slice(0, 10)),
      String(r.quantity),
      r.weight.toFixed(3),
      csvEscape(r.status),
    ].join(","));
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="item-history-${item.itemCode}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}