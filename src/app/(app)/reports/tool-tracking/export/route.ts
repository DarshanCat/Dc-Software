import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getToolsWithVendor, toolTrackingRowsToCsv } from "@/server/reports/tool-tracking";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });

  const vendorId = request.nextUrl.searchParams.get("vendorId");
  const rows = await getToolsWithVendor({ vendorId: vendorId || undefined });
  const csv = toolTrackingRowsToCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tools-with-vendor-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
