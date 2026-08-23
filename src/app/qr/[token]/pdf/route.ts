import { NextRequest, NextResponse } from "next/server";
import { loadDcPdfDataByToken, renderDcPdfBuffer } from "@/server/dcs/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PDF for a QR scan, resolved by the opaque token (24 random bytes, no
 * business data) — public by design so gate staff / vendor scans work
 * without signing in.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const data = await loadDcPdfDataByToken(token);
  if (!data) {
    return NextResponse.json({ error: "Invalid or unknown QR code." }, { status: 404 });
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
