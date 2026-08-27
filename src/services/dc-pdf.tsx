import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

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
  vendorName: string;
  vendorAddress: string;
  vendorGst: string;
  vendorPan: string;
  purpose: string;
  processName: string;
  partNumber: string;
  rmQuantity: string;
  returnFgQuantity: string;
  heatNumber: string;
  pricingBasis?: string | null;
  ratePerQuantity?: string | null;
  expectedAmount?: string | null;
  remarks?: string | null;
  vehicleNumber: string;
  transporter: string;
  ewayBillNumber: string;
  eSugamNumber: string;
  referenceNumber: string;
  expectedReturnDate: string;
  qrDataUrl: string | null;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 523.28

const DARK = rgb(0.08, 0.12, 0.2);
const GREY = rgb(0.3, 0.35, 0.42);
const LIGHT_GREY = rgb(0.45, 0.5, 0.58);
const LINE = rgb(0.75, 0.8, 0.85);
const TABLE_BG = rgb(0.93, 0.95, 0.97);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;

  // ================= 1. COMPANY HEADER =================
  let textX = MARGIN;
  if (data.logo) {
    try {
      const img = await embedLogo(pdfDoc, data.logo);
      if (img) {
        const maxW = 70;
        const maxH = 45;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: MARGIN, y: y - h + 5, width: w, height: h });
        textX = MARGIN + w + 12;
      }
    } catch {
      // ignore logo embed errors
    }
  }

  // Company Name
  page.drawText(data.company.name.toUpperCase(), { x: textX, y, size: 14, font: bold, color: DARK });
  y -= 14;

  // Company Address
  if (data.company.address) {
    const addrLines = wrapText(data.company.address, font, 8.5, PAGE_WIDTH - textX - MARGIN);
    for (const line of addrLines) {
      page.drawText(line, { x: textX, y, size: 8.5, font, color: GREY });
      y -= 11;
    }
  }

  // GST & Contact Line
  const contactLine = [
    data.company.gst ? "GSTIN: " + data.company.gst : "",
    data.company.contact,
  ]
    .filter(Boolean)
    .join("  |  ");
  if (contactLine) {
    page.drawText(contactLine, { x: textX, y, size: 8.5, font, color: GREY });
    y -= 12;
  }

  y = Math.min(y, PAGE_HEIGHT - MARGIN - 50);

  // Top Rule
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: DARK,
  });
  y -= 16;

  // Document Title
  const title = "DELIVERY CHALLAN";
  const titleWidth = bold.widthOfTextAtSize(title, 13);
  page.drawText(title, { x: (PAGE_WIDTH - titleWidth) / 2, y, size: 13, font: bold, color: DARK });
  y -= 12;

  // Sub-rule under title
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.75,
    color: LINE,
  });
  y -= 14;

  // ================= 2. DOCUMENT IDENTIFICATION & VENDOR / PROCESS GRID =================
  const boxTopY = y;
  const boxHeight = 110;

  // Outer Border Box for Header Data
  page.drawRectangle({
    x: MARGIN,
    y: boxTopY - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  // Vertical Splitter Line: Left (Consignee) = 55%, Right (DC Info) = 45%
  const splitX = MARGIN + CONTENT_WIDTH * 0.55;
  page.drawLine({
    start: { x: splitX, y: boxTopY },
    end: { x: splitX, y: boxTopY - boxHeight },
    thickness: 0.75,
    color: LINE,
  });

  // --- LEFT COLUMN: VENDOR / CONSIGNEE DETAILS ---
  let leftY = boxTopY - 12;
  page.drawText("CONSIGNEE / VENDOR DETAILS", { x: MARGIN + 8, y: leftY, size: 7.5, font: bold, color: LIGHT_GREY });
  leftY -= 14;

  page.drawText(data.vendorName, { x: MARGIN + 8, y: leftY, size: 10, font: bold, color: DARK });
  leftY -= 13;

  if (data.vendorAddress) {
    const vAddrLines = wrapText(data.vendorAddress, font, 8.5, splitX - MARGIN - 16);
    for (const line of vAddrLines.slice(0, 3)) {
      page.drawText(line, { x: MARGIN + 8, y: leftY, size: 8.5, font, color: GREY });
      leftY -= 11;
    }
  }

  const vendorTaxLine = [
    data.vendorGst ? "GST: " + data.vendorGst : "",
    data.vendorPan ? "PAN: " + data.vendorPan : "",
  ]
    .filter(Boolean)
    .join("  |  ");
  if (vendorTaxLine) {
    page.drawText(vendorTaxLine, { x: MARGIN + 8, y: leftY, size: 8, font, color: GREY });
  }

  // --- RIGHT COLUMN: DC IDENTIFICATION & PROCESS ---
  let rightY = boxTopY - 12;
  const rightPad = splitX + 8;

  const idPairs: [string, string][] = [
    ["DC Number:", data.dcNumber],
    ["DC Date:", data.dcDate],
    ["Work Order No:", data.woNumber],
    ["Process:", data.processName],
    ["Purpose:", data.purpose],
    ["Expected Return:", data.expectedReturnDate],
  ];

  for (const [label, val] of idPairs) {
    page.drawText(label, { x: rightPad, y: rightY, size: 8, font, color: GREY });
    const isBoldVal = label.includes("DC Number") || label.includes("Process");
    page.drawText(val || "—", {
      x: rightPad + 85,
      y: rightY,
      size: isBoldVal ? 9 : 8.5,
      font: isBoldVal ? bold : font,
      color: DARK,
    });
    rightY -= 15;
  }

  y = boxTopY - boxHeight - 14;

  // ================= 3. MATERIAL DETAILS SECTION =================
  const tableHeaderY = y;
  const tableHeaderHeight = 20;

  // Table Header Background
  page.drawRectangle({
    x: MARGIN,
    y: tableHeaderY - tableHeaderHeight,
    width: CONTENT_WIDTH,
    height: tableHeaderHeight,
    color: TABLE_BG,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  // Table Columns Width
  const col1W = CONTENT_WIDTH * 0.34;
  const col2W = CONTENT_WIDTH * 0.22;
  const col3W = CONTENT_WIDTH * 0.22;
  const col4W = CONTENT_WIDTH * 0.22;

  const c1X = MARGIN;
  const c2X = c1X + col1W;
  const c3X = c2X + col2W;
  const c4X = c3X + col3W;

  // Table Header Labels
  page.drawText("PART NUMBER", { x: c1X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });
  page.drawText("RM QTY (RAW MAT.)", { x: c2X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });
  page.drawText("RETURN FG QTY (EXPECTED)", { x: c3X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });
  page.drawText("HEAT NUMBER", { x: c4X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });

  // Column Separators for Header
  [c2X, c3X, c4X].forEach((colX) => {
    page.drawLine({
      start: { x: colX, y: tableHeaderY },
      end: { x: colX, y: tableHeaderY - tableHeaderHeight },
      thickness: 0.75,
      color: LINE,
    });
  });

  // Table Data Row
  const dataRowY = tableHeaderY - tableHeaderHeight;
  const dataRowHeight = 28;

  page.drawRectangle({
    x: MARGIN,
    y: dataRowY - dataRowHeight,
    width: CONTENT_WIDTH,
    height: dataRowHeight,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  page.drawText(data.partNumber || "—", { x: c1X + 8, y: dataRowY - 18, size: 9.5, font: bold, color: DARK });
  page.drawText(data.rmQuantity || "—", { x: c2X + 8, y: dataRowY - 18, size: 9.5, font: bold, color: DARK });
  page.drawText(data.returnFgQuantity || "—", { x: c3X + 8, y: dataRowY - 18, size: 9.5, font: bold, color: DARK });
  page.drawText(data.heatNumber || "—", { x: c4X + 8, y: dataRowY - 18, size: 9.5, font: bold, color: DARK });

  // Column Separators for Data Row
  [c2X, c3X, c4X].forEach((colX) => {
    page.drawLine({
      start: { x: colX, y: dataRowY },
      end: { x: colX, y: dataRowY - dataRowHeight },
      thickness: 0.75,
      color: LINE,
    });
  });

  y = dataRowY - dataRowHeight - 12;

  // ================= 4. PRICING & COMMERCIAL TERMS BLOCK =================
  const priceBoxTop = y;
  const priceBoxHeight = 32;

  page.drawRectangle({
    x: MARGIN,
    y: priceBoxTop - priceBoxHeight,
    width: CONTENT_WIDTH,
    height: priceBoxHeight,
    color: rgb(0.96, 0.98, 1.0),
    borderColor: LINE,
    borderWidth: 0.75,
  });

  const pColW = CONTENT_WIDTH / 3;
  const pricingFields: [string, string][] = [
    ["PRICING BASIS", data.pricingBasis || "—"],
    ["RATE PER QUANTITY", data.ratePerQuantity && data.ratePerQuantity !== "—" ? `INR ${data.ratePerQuantity}` : "—"],
    ["EXPECTED TOTAL AMOUNT", data.expectedAmount && data.expectedAmount !== "—" ? `INR ${data.expectedAmount}` : "—"],
  ];

  pricingFields.forEach(([label, val], idx) => {
    const px = MARGIN + idx * pColW;
    page.drawText(label, { x: px + 6, y: priceBoxTop - 11, size: 6.5, font: bold, color: LIGHT_GREY });
    page.drawText(val || "—", { x: px + 6, y: priceBoxTop - 24, size: 8.5, font: bold, color: DARK });

    if (idx > 0) {
      page.drawLine({
        start: { x: px, y: priceBoxTop },
        end: { x: px, y: priceBoxTop - priceBoxHeight },
        thickness: 0.75,
        color: LINE,
      });
    }
  });

  y = priceBoxTop - priceBoxHeight - 12;

  // ================= 5. TRANSPORT & COMPLIANCE DETAILS =================
  const transportBoxTop = y;
  const transportBoxHeight = 36;

  page.drawRectangle({
    x: MARGIN,
    y: transportBoxTop - transportBoxHeight,
    width: CONTENT_WIDTH,
    height: transportBoxHeight,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  const tColW = CONTENT_WIDTH / 4;
  const transportFields: [string, string][] = [
    ["VEHICLE NO.", data.vehicleNumber],
    ["TRANSPORTER", data.transporter],
    ["E-WAY BILL NO.", data.ewayBillNumber],
    ["E-SUGAM / REF NO.", [data.eSugamNumber, data.referenceNumber].filter((v) => v && v !== "—").join(" / ") || "—"],
  ];

  transportFields.forEach(([label, val], idx) => {
    const tx = MARGIN + idx * tColW;
    page.drawText(label, { x: tx + 6, y: transportBoxTop - 12, size: 6.5, font: bold, color: LIGHT_GREY });
    page.drawText(val || "—", { x: tx + 6, y: transportBoxTop - 25, size: 8.5, font, color: DARK });

    if (idx > 0) {
      page.drawLine({
        start: { x: tx, y: transportBoxTop },
        end: { x: tx, y: transportBoxTop - transportBoxHeight },
        thickness: 0.75,
        color: LINE,
      });
    }
  });

  y = transportBoxTop - transportBoxHeight - 14;

  // ================= 5. REMARKS SECTION =================
  const remarksBoxTop = y;
  const remarksText = data.remarks?.trim() || "";
  const remarksLines = wrapText(remarksText, font, 8.5, CONTENT_WIDTH - 16);
  const remarksBoxHeight = Math.max(38, 20 + remarksLines.length * 11);

  page.drawRectangle({
    x: MARGIN,
    y: remarksBoxTop - remarksBoxHeight,
    width: CONTENT_WIDTH,
    height: remarksBoxHeight,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  page.drawText("REMARKS / INSTRUCTIONS", { x: MARGIN + 8, y: remarksBoxTop - 12, size: 7, font: bold, color: LIGHT_GREY });

  if (remarksLines.length > 0) {
    let ry = remarksBoxTop - 24;
    for (const line of remarksLines) {
      page.drawText(line, { x: MARGIN + 8, y: ry, size: 8.5, font, color: DARK });
      ry -= 11;
    }
  } else {
    page.drawText("NIL", { x: MARGIN + 8, y: remarksBoxTop - 25, size: 8.5, font, color: GREY });
  }

  y = remarksBoxTop - remarksBoxHeight - 14;

  // ================= 6. TERMS & CONDITIONS =================
  const termsText =
    "TERMS & CONDITIONS: Material listed above is dispatched for job work processing only and remains the sole property of " +
    data.company.name +
    ". The consignee/receiving party is responsible for safe custody and return of the processed material along with any finished goods / scrap generated as per agreed terms.";

  const termsLines = wrapText(termsText, font, 7, CONTENT_WIDTH);
  for (const line of termsLines) {
    page.drawText(line, { x: MARGIN, y, size: 7, font, color: LIGHT_GREY });
    y -= 9;
  }

  // ================= 7. SIGNATURE SECTION & QR CODE =================
  const footerY = 55;
  const signBoxWidth = (CONTENT_WIDTH - 70) / 4; // Reserve 70pt on right for QR Code

  const signBlocks: { label: string; name: string | null }[] = [
    { label: "Prepared By", name: data.preparedByName || null },
    { label: "Approved By", name: data.approvedByName || null },
    { label: "Receiver Signature", name: null },
    { label: "Authorized Signature", name: null },
  ];

  signBlocks.forEach((block, idx) => {
    const sx = MARGIN + idx * signBoxWidth;

    // Printed Name above line
    if (block.name) {
      page.drawText(block.name, { x: sx, y: footerY + 22, size: 8.5, font: bold, color: DARK });
    }

    // Signature Line
    page.drawLine({
      start: { x: sx, y: footerY + 14 },
      end: { x: sx + signBoxWidth - 12, y: footerY + 14 },
      thickness: 0.75,
      color: LINE,
    });

    // Signature Label
    page.drawText(block.label, { x: sx, y: footerY, size: 7.5, font, color: GREY });
  });

  // Embedded QR Code (Bottom Right)
  if (data.qrDataUrl && data.qrDataUrl.startsWith("data:image/png;base64,")) {
    try {
      const base64 = data.qrDataUrl.split(",")[1];
      const qrBytes = Buffer.from(base64, "base64");
      const qrImage = await pdfDoc.embedPng(qrBytes);
      const qrSize = 54;
      const qrX = PAGE_WIDTH - MARGIN - qrSize;
      page.drawImage(qrImage, { x: qrX, y: footerY + 2, width: qrSize, height: qrSize });
      const caption = "Scan to verify";
      page.drawText(caption, {
        x: qrX + (qrSize - font.widthOfTextAtSize(caption, 6)) / 2,
        y: footerY - 6,
        size: 6,
        font,
        color: LIGHT_GREY,
      });
    } catch {
      // ignore QR render error
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}