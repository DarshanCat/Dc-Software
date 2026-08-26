import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { generateDcPdf, loadDcPdfData } from "@/server/dcs/pdf";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const canView = await hasPermission(user.id, PERMISSIONS.DC_VIEW);
  if (!canView) {
    return NextResponse.json({ error: "You do not have permission to view this DC." }, { status: 403 });
  }

  const [data, pdfBuffer] = await Promise.all([
    loadDcPdfData(id),
    generateDcPdf(id),
  ]);

  if (!data || !pdfBuffer) {
    return NextResponse.json({ error: "DC not found." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.dcNumber}.pdf"`,
    },
  });
}
