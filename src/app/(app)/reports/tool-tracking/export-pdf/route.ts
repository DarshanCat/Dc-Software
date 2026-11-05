import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getToolsWithVendor } from "@/server/reports/tool-tracking";
import { renderReportPdf } from "@/services/report-pdf";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const canExport = await hasPermission(user.id, PERMISSIONS.REPORT_EXPORT);
  if (!canExport) return NextResponse.json({ error: "You do not have permission to export reports." }, { status: 403 });

  const vendorId = request.nextUrl.searchParams.get("vendorId");
  const rows = await getToolsWithVendor({ vendorId: vendorId || undefined });

  const pdfBuffer = await renderReportPdf({
    title: "Tools Currently With Vendor",
    subtitle: `Generated ${new Date().toLocaleString()} - ${rows.length} tool(s) dispatched and not yet returned`,
    columns: [
      { header: "DC NUMBER", width: 0.11 },
      { header: "VENDOR", width: 0.17 },
      { header: "TOOL CODE", width: 0.12 },
      { header: "TOOL NAME", width: 0.2 },
      { header: "SERIAL NO.", width: 0.12 },
      { header: "QTY", width: 0.05 },
      { header: "STATUS", width: 0.11 },
      { header: "DAYS OUT", width: 0.06 },
      { header: "EXPECTED RETURN", width: 0.06 },
    ],
    rows: rows.map((r) => [
      r.dcNumber,
      r.vendorName,
      r.toolCode,
      r.toolName,
      r.serialNumber,
      String(r.quantity),
      r.status.replace(/_/g, " "),
      r.daysOut === null ? "—" : String(r.daysOut),
      r.expectedReturnDate ? r.expectedReturnDate.toLocaleDateString() : "—",
    ]),
  });

  return new NextResponse(Buffer.from(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tools-with-vendor-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
