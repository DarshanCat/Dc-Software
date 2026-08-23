import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export interface DcPdfItem {
  slNo: number;
  itemCode: string;
  description: string;
  drawingNumber: string;
  quantity: string;
  uom: string;
  weight: string;
}

export interface DcPdfData {
  company: { name: string; address: string; gst: string; contact: string };
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
  vehicleNumber: string;
  transporter: string;
  ewayBillNumber: string;
  referenceNumber: string;
  expectedReturnDate: string;
  items: DcPdfItem[];
  qrDataUrl: string | null;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const DARK = rgb(0.06, 0.09, 0.16);
const GREY = rgb(0.28, 0.33, 0.41);
const LIGHT_GREY = rgb(0.4, 0.45, 0.55);
const LINE = rgb(0.79, 0.84, 0.9);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function rightAlignedX(text: string, font: PDFFont, size: number, rightEdge: number): number {
  return rightEdge - font.widthOfTextAtSize(text, size);
}

async function embedLogo(doc: PDFDocument, dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bytes = Buffer.from(base64, "base64");
  if (dataUrl.startsWith("data:image/png")) return doc.embedPng(bytes);
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return doc.embedJpg(bytes);
  return null;
}

export async function renderDcPdf(data: DcPdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  let y = PAGE_HEIGHT - MARGIN;

  let textX = MARGIN;
  if (data.logo) {
    try {
      const img = await embedLogo(pdfDoc, data.logo);
      if (img) {
        const maxW = 64;
        const maxH = 36;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: MARGIN, y: y - h / 2 - 4, width: w, height: h });
        textX = MARGIN + w + 12;
      }
    } catch {
      // ignore malformed logo
    }
  }

  page.drawText(data.company.name, { x: textX, y, size: 15, font: bold, color: DARK });
  const dcNoText = "DC No.";
  page.drawText(dcNoText, {
    x: rightAlignedX(dcNoText, font, 8, PAGE_WIDTH - MARGIN),
    y,
    size: 8,
    font,
    color: LIGHT_GREY,
  });
  y -= 13;

  if (data.company.address) {
    page.drawText(data.company.address, { x: textX, y, size: 8, font, color: GREY });
  }
  page.drawText(data.dcNumber, {
    x: rightAlignedX(data.dcNumber, bold, 13, PAGE_WIDTH - MARGIN),
    y: y + 1,
    size: 13,
    font: bold,
    color: DARK,
  });
  y -= 11;

  const contactLine = [data.company.gst ? "Our GST: " + data.company.gst : "", data.company.contact]
    .filter(Boolean)
    .join("  |  ");
  if (contactLine) {
    page.drawText(contactLine, { x: textX, y, size: 8, font, color: GREY });
  }
  page.drawText(data.status, {
    x: rightAlignedX(data.status, font, 8, PAGE_WIDTH - MARGIN),
    y,
    size: 8,
    font,
    color: GREY,
  });
  y -= 22;

  const title = "DELIVERY CHALLAN";
  const titleWidth = bold.widthOfTextAtSize(title, 13);
  page.drawText(title, { x: (PAGE_WIDTH - titleWidth) / 2, y, size: 13, font: bold, color: DARK });
  y -= 18;

  page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 4 }, thickness: 0.75, color: LINE });
  y -= 10;

  const infoPairs: [string, string][] = [
    ["Date", data.dcDate],
    ["Vendor", data.vendorName],
    ["Purpose", data.purpose],
    ["Process", data.processName],
    ["Expected Return", data.expectedReturnDate],
    ["Vehicle No.", data.vehicleNumber],
    ["Transporter", data.transporter],
    ["E-Way Bill", data.ewayBillNumber],
    ["Reference No.", data.referenceNumber],
    ["Vendor Address", data.vendorAddress],
    ["Party's GST No.", data.vendorGst || "—"],
    ["Party's PAN No.", data.vendorPan || "—"],
  ];
  const colWidth = CONTENT_WIDTH / 2;
  for (let i = 0; i < infoPairs.length; i += 2) {
    const rowY = y;
    for (let c = 0; c < 2; c++) {
      const pair = infoPairs[i + c];
      if (!pair) continue;
      const x = MARGIN + c * colWidth;
      page.drawText(pair[0].toUpperCase(), { x, y: rowY, size: 6.5, font, color: LIGHT_GREY });
      page.drawText(pair[1] || "-", { x, y: rowY - 10, size: 9.5, font: bold, color: DARK });
    }
    y -= 26;
  }

  y += 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: LINE });
  y -= 16;

  const cols = [
    { key: "slNo", label: "Sl", width: 28, align: "left" as const },
    { key: "itemCode", label: "Item Code", width: 75, align: "left" as const },
    { key: "description", label: "Description", width: 140, align: "left" as const },
    { key: "drawingNumber", label: "Drawing", width: 80, align: "left" as const },
    { key: "quantity", label: "Qty", width: 45, align: "right" as const },
    { key: "uom", label: "UOM", width: 40, align: "left" as const },
    { key: "weight", label: "Weight (kg)", width: 75, align: "right" as const },
  ];

  function drawTableRow(values: string[], rowY: number, opts: { header?: boolean } = {}) {
    let x = MARGIN;
    const f = opts.header ? bold : font;
    const size = opts.header ? 7.5 : 8.5;
    const color = opts.header ? GREY : DARK;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const text = opts.header ? col.label.toUpperCase() : values[i];
      const textX = col.align === "right" ? x + col.width - f.widthOfTextAtSize(text, size) : x;
      page.drawText(text, { x: textX, y: rowY, size, font: f, color });
      x += col.width;
    }
  }

  drawTableRow([], y, { header: true });
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: LINE });
  y -= 12;

  for (const item of data.items) {
    drawTableRow(
      [String(item.slNo), item.itemCode, item.description, item.drawingNumber, item.quantity, item.uom, item.weight],
      y,
    );
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: LINE });
    y -= 12;
  }

  y -= 8;

  const termsText =
    "Terms: Material listed above is sent for job work only and remains the property of " +
    data.company.name +
    ". The receiving party is responsible for the safe custody and timely return of the material and any " +
    "finished goods / scrap generated, as per the agreed job work terms.";
  const termsLines = wrapText(termsText, font, 7, CONTENT_WIDTH);
  for (const line of termsLines) {
    page.drawText(line, { x: MARGIN, y, size: 7, font, color: LIGHT_GREY });
    y -= 9;
  }

  const footerY = 70;
  const signBoxWidth = CONTENT_WIDTH / 4;
  const signLabels = ["Prepared By", "Approved By", "Authorized Signature"];
  const signNames = [data.preparedByName ?? "", data.approvedByName ?? "", ""];
  signLabels.forEach((label, i) => {
    const x = MARGIN + i * signBoxWidth;
    const name = signNames[i];
    if (name) {
      page.drawText(name, { x, y: footerY + 21, size: 8.5, font: bold, color: DARK });
    }
    page.drawLine({ start: { x, y: footerY + 14 }, end: { x: x + signBoxWidth - 20, y: footerY + 14 }, thickness: 0.75, color: LINE });
    page.drawText(label, { x, y: footerY, size: 8, font, color: GREY });
  });

  if (data.qrDataUrl && data.qrDataUrl.startsWith("data:image/png;base64,")) {
    const base64 = data.qrDataUrl.split(",")[1];
    const qrBytes = Buffer.from(base64, "base64");
    const qrImage = await pdfDoc.embedPng(qrBytes);
    const qrSize = 60;
    const qrX = PAGE_WIDTH - MARGIN - qrSize;
    page.drawImage(qrImage, { x: qrX, y: footerY, width: qrSize, height: qrSize });
    const caption = "Scan for DC details";
    page.drawText(caption, {
      x: qrX + (qrSize - font.widthOfTextAtSize(caption, 6)) / 2,
      y: footerY - 8,
      size: 6,
      font,
      color: LIGHT_GREY,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}