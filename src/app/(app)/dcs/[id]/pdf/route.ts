import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { buildDcQrUrl } from "@/services/dispatch.service";
import { renderDcPdf } from "@/services/dc-pdf";

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

  const dc = await prisma.deliveryChallan.findUnique({
    where: { id },
    include: { vendor: true, process: true, items: { include: { item: true } } },
  });
  if (!dc) {
    return NextResponse.json({ error: "DC not found." }, { status: 404 });
  }

  const settingsRows = await prisma.systemSetting.findMany({
    where: { key: { in: ["companyName", "companyAddress", "gstNumber", "contactEmail", "contactPhone"] } },
  });
  const settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
  const contactParts = [settings.contactPhone, settings.contactEmail].filter(Boolean);

  const qrDataUrl = dc.qrToken ? await QRCode.toDataURL(buildDcQrUrl(dc.id), { margin: 1, width: 200 }) : null;

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