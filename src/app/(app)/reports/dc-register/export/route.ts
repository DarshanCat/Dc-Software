import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getDcRegisterRows, rowsToCsv } from "@/server/reports/dc-register";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) {
    return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const filters = {
    vendorId: params.get("vendorId") || undefined,
    status: params.get("status") || undefined,
    purpose: params.get("purpose") || undefined,
    processId: params.get("processId") || undefined,
    dateFrom: params.get("dateFrom") || undefined,
    dateTo: params.get("dateTo") || undefined,
  };

  const { rows } = await getDcRegisterRows(filters);
  const csv = rowsToCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dc-register-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}