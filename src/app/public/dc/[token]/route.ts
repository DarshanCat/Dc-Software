import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { buildDcPublicUrl } from "@/services/dispatch.service";
import { renderDcPdf } from "@/services/dc-pdf";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const dc = await prisma.deliveryChallan.findUnique({
    where: { qrToken: token },
    include: { vendor: true, process: true, items: { include: { item: true } } },
  });

  if (!dc) {
    return NextResponse.json({ error: "Invalid or expired QR code." }, { status: 404 });
  }

  const settingsRows = await prisma.systemSetting.findMany({
    where: { key: { in: ["companyName", "companyAddress", "gstNumber", "contactEmail", "contactPhone"] } },
  });
  const settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
  const contactParts = [settings.contactPhone, settings.contactEmail].filter(Boolean);

  const qrDataUrl = await QRCode.toDataURL(buildDcPublicUrl(dc.qrToken!), { margin: 1, width: 200 });

  const pdfBuffer = await renderDcPdf({
    company: {
      name: settings.companyName || "DC & Vendor Material Management",
      address: settings.companyAddress || "",
      gst: settings.gstNumber || "",
      contact: contactParts.join(" | "),
    },
    dcNumber: dc.dcNumber,
    dcDate: dc.dcDate.toLocaleDateString(),
    status: dc.status.replace(/_/g, " "),
    vendorName: dc.vendor.vendorName,
    vendorAddress: dc.vendor.address || "",
    purpose: dc.purpose.replace(/_/g, " "),
    processName: dc.process?.name ?? "—",
    vehicleNumber: dc.vehicleNumber || "—",
    transporter: dc.transporter || "—",
    ewayBillNumber: dc.ewayBillNumber || "—",
    referenceNumber: dc.referenceNumber || "—",
    expectedReturnDate: dc.expectedReturnDate ? dc.expectedReturnDate.toLocaleDateString() : "—",
    items: dc.items.map((it, idx) => ({
      slNo: idx + 1,
      itemCode: it.item.itemCode,
      description: it.item.itemName,
      drawingNumber: it.drawingNumber || it.item.drawingNumber || "—",
      quantity: Number(it.quantity).toString(),
      uom: it.uom,
      weight: Number(it.inputWeight).toFixed(3),
    })),
    qrDataUrl,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dc.dcNumber}.pdf"`,
    },
  });
}