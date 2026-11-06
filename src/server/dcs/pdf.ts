import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { buildDcQrUrl } from "@/services/dispatch.service";
import { getCompanyLogoDataUrl } from "@/services/company-branding";
import { renderDcPdf } from "@/services/dc-pdf";

const dcInclude = { vendor: true, process: true, items: true } as const;

/** Structural view of a DC row (with relations) needed to render its PDF. */
interface DcRowLike {
  dcNumber: string;
  dcDate: Date;
  status: string;
  purpose: string;
  movementType: string;
  destinationDepartment: string | null;
  responsibleCustodian: string | null;
  woNumber: string;
  partNumber: string | null;
  rmQuantity: unknown;
  returnFgQuantity: unknown;
  returnGatingQty?: unknown;
  rmUom: string | null;
  fgUom: string | null;
  outwardWeight: unknown;
  heatNumber: string | null;
  materialGrade: string | null;
  materialType: string | null;
  remarks: string | null;
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
  supplierNameSnapshot?: string | null;
  supplierAddressSnapshot?: string | null;
  supplierGstSnapshot?: string | null;
  length?: unknown;
  width?: unknown;
  height?: unknown;
  dimensionUom?: string | null;
  vendor: { vendorName: string; address: string | null; gstNumber: string | null; panNumber: string | null } | null;
  process: { name: string } | null;
  items: Array<{
    itemCode: string | null;
    itemDescription: string;
    quantity: unknown;
    uom: string;
    conditionIn: string | null;
    toolInstanceId: string | null;
    assetMasterId: string | null;
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
  woNumber: string;
  status: string;
  movementType: string;
  destinationDepartment: string | null;
  responsibleCustodian: string | null;
  items: Array<{ label: string; description: string; serial: string; quantity: string; condition: string }>;
  vendorName: string;
  vendorAddress: string;
  vendorGst: string;
  vendorPan: string;
  purpose: string;
  processName: string;
  partNumber: string;
  rmQuantity: string;
  returnFgQuantity: string;
  returnGatingQty?: string | null;
  weightKg: string;
  dimensions?: string | null;
  heatNumber: string;
  materialGrade: string;
  materialType: string;
  pricingBasis: string | null;
  ratePerQuantity: string | null;
  expectedAmount: string | null;
  remarks: string | null;
  vehicleNumber: string;
  transporter: string;
  ewayBillNumber: string;
  eSugamNumber: string;
  referenceNumber: string;
  expectedReturnDate: string;
  qrDataUrl: string | null;
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

async function resolveItemsForPdf(
  items: DcRowLike["items"],
): Promise<DcPdfData["items"]> {
  if (items.length === 0) return [];

  const toolInstanceIds = [...new Set(items.map((i) => i.toolInstanceId).filter((v): v is string => !!v))];
  const assetMasterIds = [...new Set(items.map((i) => i.assetMasterId).filter((v): v is string => !!v))];

  const [toolInstances, assetMasters] = await Promise.all([
    prisma.toolInstance.findMany({ where: { id: { in: toolInstanceIds } }, include: { toolMaster: true } }),
    prisma.assetMaster.findMany({ where: { id: { in: assetMasterIds } } }),
  ]);

  const toolInstanceMap = new Map(toolInstances.map((ti) => [ti.id, ti]));
  const assetMasterMap = new Map(assetMasters.map((am) => [am.id, am]));

  return items.map((item) => {
    const toolInstance = item.toolInstanceId ? toolInstanceMap.get(item.toolInstanceId) : undefined;
    const assetMaster = item.assetMasterId ? assetMasterMap.get(item.assetMasterId) : undefined;
    return {
      label: toolInstance?.toolMaster?.toolCode || assetMaster?.assetTag || item.itemCode || "—",
      description: item.itemDescription || "—",
      serial: toolInstance?.serialNumber || assetMaster?.serialNumber || "—",
      quantity: `${Number(item.quantity).toFixed(3)} ${item.uom || "NOS"}`,
      condition: item.conditionIn || "—",
    };
  });
}

async function buildPdfData(dc: DcRowLike & { pricingBasis?: string | null; ratePerQuantity?: unknown; expectedAmount?: unknown }): Promise<DcPdfData> {
  const [company, qrDataUrl, logo, items] = await Promise.all([
    fetchCompanySettings(),
    dc.qrToken
      ? QRCode.toDataURL(buildDcQrUrl(dc.qrToken), { margin: 1, width: 200 })
      : Promise.resolve(null),
    getCompanyLogoDataUrl(),
    resolveItemsForPdf(dc.items ?? []),
  ]);

  return {
    company,
    logo,
    preparedByName: dc.preparedByName || null,
    approvedByName: dc.approvedByName || null,
    dcNumber: dc.dcNumber,
    dcDate: dc.dcDate.toLocaleDateString(),
    woNumber: dc.woNumber,
    status: dc.status.replace(/_/g, " "),
    movementType: dc.movementType,
    destinationDepartment: dc.destinationDepartment || null,
    responsibleCustodian: dc.responsibleCustodian || null,
    items,
    vendorName: dc.vendor?.vendorName || dc.supplierNameSnapshot || "INTERNAL",
    // Snapshot takes precedence: historical DCs must retain their original vendor address
    // even if Vendor Master is edited later. Live vendor address is only a fallback for
    // legacy DCs created before the snapshot was captured.
    vendorAddress: dc.supplierAddressSnapshot || dc.vendor?.address || "",
    vendorGst: dc.vendor?.gstNumber || dc.supplierGstSnapshot || "",
    vendorPan: dc.vendor?.panNumber || "",
    purpose: dc.purpose.replace(/_/g, " "),
    processName: dc.process?.name ?? "—",
    partNumber: dc.partNumber || "—",
    rmQuantity: dc.rmQuantity != null ? `${Number(dc.rmQuantity).toFixed(3)} ${dc.rmUom || "NOS"}` : "—",
    returnFgQuantity: dc.returnFgQuantity != null ? `${Number(dc.returnFgQuantity).toFixed(3)} ${dc.fgUom || "NOS"}` : "—",
    returnGatingQty: dc.returnGatingQty != null ? `${Number(dc.returnGatingQty)} NOS` : null,
    weightKg: dc.outwardWeight != null ? `${Number(dc.outwardWeight).toFixed(3)} KG` : "—",
    dimensions:
      dc.length != null && dc.width != null && dc.height != null
        ? `${Number(dc.length)} × ${Number(dc.width)} × ${Number(dc.height)} MM`
        : null,
    heatNumber: dc.heatNumber || "—",
    materialGrade: dc.materialGrade || "—",
    materialType: dc.materialType === "PRODUCTION" ? "Production" : dc.materialType === "CONVERSION" ? "Conversion" : "—",
    pricingBasis: dc.pricingBasis ? (dc.pricingBasis === "RM" ? "Price Based On: RM Quantity" : "Price Based On: FG Quantity") : "—",
    ratePerQuantity: dc.ratePerQuantity != null ? Number(dc.ratePerQuantity).toFixed(2) : "—",
    expectedAmount: dc.expectedAmount != null ? Number(dc.expectedAmount).toFixed(2) : "—",
    remarks: (() => {
      let r = dc.remarks?.trim() || "";
      if (dc.returnGatingQty != null && !r.toUpperCase().includes("GATTING")) {
        const gatting = `${Number(dc.returnGatingQty)}-GATTINGS`;
        r = r ? `${gatting} | ${r}` : gatting;
      }
      return r || null;
    })(),
    vehicleNumber: dc.vehicleNumber || "—",
    transporter: dc.transporter || "—",
    ewayBillNumber: dc.ewayBillNumber || "—",
    eSugamNumber: dc.eSugamNumber || "—",
    referenceNumber: dc.referenceNumber || "—",
    expectedReturnDate: dc.expectedReturnDate ? dc.expectedReturnDate.toLocaleDateString() : "—",
    qrDataUrl,
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

export async function generateDcPdf(dcId: string): Promise<Uint8Array | null> {
  const data = await loadDcPdfData(dcId);
  if (!data) return null;
  return renderDcPdf(data);
}

export async function generateDcPdfByToken(token: string): Promise<Uint8Array | null> {
  const data = await loadDcPdfDataByToken(token);
  if (!data) return null;
  return renderDcPdf(data);
}

export const renderDcPdfBuffer = generateDcPdf;
export const renderDcPdfBufferByToken = generateDcPdfByToken;
