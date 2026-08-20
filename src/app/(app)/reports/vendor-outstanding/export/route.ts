import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getVendorOutstandingRows, vendorRowsToCsv } from "@/server/reports/vendor-outstanding";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) {
    return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });
  }

  const rows = await getVendorOutstandingRows();
  const csv = vendorRowsToCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendor-outstanding-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}