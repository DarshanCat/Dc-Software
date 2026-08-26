import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { evaluateScrap } from "@/services/scrap.service";

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED"] } },
    include: { vendor: true, scrapReceipts: { include: { items: true } } },
  });

  const byVendor = new Map<string, { name: string; expected: number; received: number; dcCount: number }>();
  for (const dc of dcs) {
    const expected = Number(dc.expectedScrap ?? 0);
    const received = dc.scrapReceipts.reduce((s, r) => s + r.items.reduce((si, ri) => si + Number(ri.weight), 0), 0);
    if (expected <= 0 && received <= 0) continue;
    const entry = byVendor.get(dc.vendorId) ?? { name: dc.vendor.vendorName, expected: 0, received: 0, dcCount: 0 };
    entry.expected += expected;
    entry.received += received;
    entry.dcCount += 1;
    byVendor.set(dc.vendorId, entry);
  }

  const header = ["Vendor", "DCs", "Expected Scrap (kg)", "Received Scrap (kg)", "Recovery %"];
  const lines = [header.join(",")];
  for (const r of byVendor.values()) {
    const evalResult = evaluateScrap(r.expected, r.received, 0);
    lines.push([csvEscape(r.name), String(r.dcCount), r.expected.toFixed(3), r.received.toFixed(3), evalResult.recoveryPercent === null ? "N/A" : evalResult.recoveryPercent.toFixed(1)].join(","));
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scrap-recovery-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}