import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { buildDcQrUrl } from "@/services/dispatch.service";
import { getCompanyLogoDataUrl } from "@/services/company-branding";
import { renderDcPdf } from "@/services/dc-pdf";

const dcInclude = { vendor: true, process: true, items: { include: { item: true } } } as const;

/** Structural view of a DC row (with relations) needed to render its PDF. */
interface DcRowLike {
  dcNumber: string;
  dcDate: Date;
  status: string;
  purpose: string;
  woNumber: string;
  partNumber: string | null;
  expectedScrap: unknown;
  vehicleNumber: string | null;
  transporter: string | null;
  ewayBillNumber: string | null;
  eSugamNumber: string | null;
  referenceNumber: string | null;
  expectedReturnDate: Date | null;
  qrToken: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  preparedByName: string | null;
  approvedByName: string | null;
  vendor: { vendorName: string; address: string | null; gstNumber: string | null; panNumber: string | null };
  process: { name: string } | null;
  items: Array<{
    drawingNumber: string | null;
    quantity: unknown;
    uom: string;
    inputWeight: unknown;
    item: { itemCode: string; itemName: string; drawingNumber: string | null };
  }>;
}

/** Everything the PDF renderer needs, flattened to plain scalars. */
export interface DcPdfData {
  company: {
    name: string;
    address: string;
    gst: string;
    contact: string;
  };
  logo?: string | null;
  preparedByName?: string | null;
  approvedByName?: string | null;
  dcNumber: string;
  dcDate: string;
  status: string;
  vendorName: string;
  vendorAddress: string;
  vendorGst: string;
  vendorPan: string;
  purpose: string;
  processName: string;
  partNumber?: string | null;
  expectedScrap?: string | null;
  vehicleNumber: string;
  transporter: string;
  ewayBillNumber: string;
  eSugamNumber: string;
  referenceNumber: string;
  expectedReturnDate: string;
  qrDataUrl: string | null;
  items: Array<{
    slNo: number;
    itemCode: string;
    description: string;
    drawingNumber: string;
    quantity: string;
    uom: string;
    weight: string;
  }>;
}

async function fetchCompanySettings() {
  const settingsRows = await prisma.systemSetting.findMany({
    where: { key: { in: ["companyName", "companyAddress", "gstNumber", "contactEmail", "contactPhone"] } },
  });
  const s = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  return {
    name: s.companyName || "DC & Vendor Material Management",
    address: s.companyAddress || "",
    gst: s.gstNumber || "",
    contact: [s.contactPhone, s.contactEmail].filter(Boolean).join(" | "),
  };
}

async function buildPdfData(dc: DcRowLike): Promise<DcPdfData> {
  const [company, qrDataUrl, logo] = await Promise.all([
    fetchCompanySettings(),
    dc.qrToken
      ? QRCode.toDataURL(buildDcQrUrl(dc.qrToken), { margin: 1, width: 200 })
      : Promise.resolve(null),
    getCompanyLogoDataUrl(),
  ]);

  return {
    company,
    logo,
    preparedByName: dc.preparedByName || null,
    approvedByName: dc.approvedByName || null,
    dcNumber: dc.dcNumber,
    dcDate: dc.dcDate.toLocaleDateString(),
    status: dc.status.replace(/_/g, " "),
    vendorName: dc.vendor.vendorName,
    vendorAddress: dc.vendor.address || "",
    vendorGst: dc.vendor.gstNumber || "",
    vendorPan: dc.vendor.panNumber || "",
    purpose: dc.purpose.replace(/_/g, " "),
    processName: dc.process?.name ?? "—",
    partNumber: dc.partNumber || "—",
    expectedScrap: dc.expectedScrap != null ? Number(dc.expectedScrap).toFixed(3) + " kg" : "—",
    vehicleNumber: dc.vehicleNumber || "—",
    transporter: dc.transporter || "—",
    ewayBillNumber: dc.ewayBillNumber || "—",
    eSugamNumber: dc.eSugamNumber || "—",
    referenceNumber: dc.referenceNumber || "—",
    expectedReturnDate: dc.expectedReturnDate ? dc.expectedReturnDate.toLocaleDateString() : "—",
    qrDataUrl,
    items: dc.items.map((it, idx) => ({
      slNo: idx + 1,
      itemCode: it.item.itemCode,
      description: it.item.itemName,
      drawingNumber: it.drawingNumber || it.item.drawingNumber || "—",
      quantity: Number(it.quantity).toString(),
      uom: it.uom,
      weight: Number(it.inputWeight).toFixed(3),
    })),
  };
}

/** PDF data for an internal (authed) lookup by DC id. */
export async function loadDcPdfData(id: string): Promise<DcPdfData | null> {
  const dc = await prisma.deliveryChallan.findUnique({ where: { id }, include: dcInclude });
  return dc ? buildPdfData(dc) : null;
}

/**
 * PDF data for a QR scan by resolving the opaque token server-side.
 * Public by design — the token is 24 random bytes with no business information.
 */
export async function loadDcPdfDataByToken(qrToken: string): Promise<DcPdfData | null> {
  const dc = await prisma.deliveryChallan.findUnique({ where: { qrToken }, include: dcInclude });
  return dc ? buildPdfData(dc) : null;
}

export async function renderDcPdfBuffer(data: Omit<DcPdfData, "company">): Promise<Uint8Array> {
  const company = await fetchCompanySettings();
  return renderDcPdf({ ...data, company });
}
