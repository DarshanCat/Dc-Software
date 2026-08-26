import { NextRequest, NextResponse } from "next/server";
import { loadDcPdfDataByToken, generateDcPdfByToken } from "@/server/dcs/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [data, pdfBuffer] = await Promise.all([
    loadDcPdfDataByToken(token),
    generateDcPdfByToken(token),
  ]);

  if (!data || !pdfBuffer) {
    return NextResponse.json({ error: "Invalid or expired QR code." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.dcNumber}.pdf"`,
    },
  });
}