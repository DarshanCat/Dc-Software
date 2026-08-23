import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { loadDcPdfData, renderDcPdfBuffer } from "@/server/dcs/pdf";

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

  const data = await loadDcPdfData(id);
  if (!data) {
    return NextResponse.json({ error: "DC not found." }, { status: 404 });
  }

  const pdfBuffer = await renderDcPdfBuffer(data);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.dcNumber}.pdf"`,
    },
  });
}
