import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED", "CLOSED"] } },
    include: { vendor: true, receipts: { include: { items: true } } },
  });

  const byVendor = new Map<string, { name: string; sentWeight: number; returnedWeight: number; dcCount: number }>();
  for (const dc of dcs) {
    if (!dc.vendorId) continue;
    const sentWeight = Number(dc.rmQuantity ?? 0);
    const returnedWeight = dc.receipts.reduce(
      (s, r) => s + r.items.reduce((si, ri) => si + Number(ri.weightReceived), 0), 0);
    const entry = byVendor.get(dc.vendorId) ?? { name: dc.vendor?.vendorName || dc.supplierNameSnapshot || "N/A", sentWeight: 0, returnedWeight: 0, dcCount: 0 };
    entry.sentWeight += sentWeight;
    entry.returnedWeight += returnedWeight;
    entry.dcCount += 1;
    byVendor.set(dc.vendorId, entry);
  }

  const rows = Array.from(byVendor.values()).sort((a, b) => (b.sentWeight - b.returnedWeight) - (a.sentWeight - a.returnedWeight));

  const header = ["Vendor", "Active DCs", "Sent Weight (kg)", "Returned Weight (kg)", "Outstanding (kg)"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const outstanding = Math.max(r.sentWeight - r.returnedWeight, 0);
    lines.push([csvEscape(r.name), String(r.dcCount), r.sentWeight.toFixed(3), r.returnedWeight.toFixed(3), outstanding.toFixed(3)].join(","));
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="material-outstanding-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}