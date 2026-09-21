import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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
  weightKg: string;
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

function getTextWidth(text: string, font: PDFFont, size: number): number {
  try {
    const safeText = text.replace(/[^\x00-\x7F]/g, "?");
    return font.widthOfTextAtSize(safeText, size);
  } catch {
    return text.length * size * 0.5;
  }
}

/**
 * Robust cell text wrapping algorithm.
 * Handles normal text, spaces, commas, hyphens, slashes, numbers,
 * and breaks unbroken long strings character-by-character if a token exceeds maxWidth.
 */
export function wrapCellText(
  text: string | null | undefined,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  if (!text) return [];
  if (maxWidth <= 0) return [];

  const paragraphs = text.split(/\r?\n/);
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) {
      continue;
    }

    const rawWords = trimmedPara.split(/\s+/);

    interface Unit {
      text: string;
      hasLeadingSpace: boolean;
    }
    const units: Unit[] = [];

    for (let i = 0; i < rawWords.length; i++) {
      const rawWord = rawWords[i];
      if (!rawWord) continue;
      const isWordStart = i > 0;

      // Split rawWord by common delimiters, keeping the delimiter attached to the preceding subtoken
      const subTokens = rawWord.split(/(?<=[,-/_:.@])/);
      let isFirstSub = true;

      for (const st of subTokens) {
        if (!st) continue;

        if (getTextWidth(st, font, size) <= maxWidth) {
          units.push({
            text: st,
            hasLeadingSpace: isFirstSub ? isWordStart : false,
          });
        } else {
          // Break long subToken character-by-character
          let currentChunk = "";
          for (const char of st) {
            const candidate = currentChunk + char;
            if (getTextWidth(candidate, font, size) > maxWidth && currentChunk) {
              units.push({
                text: currentChunk,
                hasLeadingSpace: isFirstSub ? isWordStart : false,
              });
              currentChunk = char;
              isFirstSub = false;
            } else {
              currentChunk = candidate;
            }
          }
          if (currentChunk) {
            units.push({
              text: currentChunk,
              hasLeadingSpace: isFirstSub ? isWordStart : false,
            });
          }
        }
        isFirstSub = false;
      }
    }

    let currentLine = "";

    for (const unit of units) {
      if (!currentLine) {
        currentLine = unit.text;
      } else {
        const candidate = unit.hasLeadingSpace ? currentLine + " " + unit.text : currentLine + unit.text;
        if (getTextWidth(candidate, font, size) <= maxWidth) {
          currentLine = candidate;
        } else {
          resultLines.push(currentLine);
          currentLine = unit.text;
        }
      }
    }

    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  return wrapCellText(text, font, size, maxWidth);
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
  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (neededHeight: number) => {
    const MIN_Y = 110; // Reserve space for bottom signatures
    if (y - neededHeight < MIN_Y) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

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
        currentPage.drawImage(img, { x: MARGIN, y: y - h + 5, width: w, height: h });
        textX = MARGIN + w + 12;
      }
    } catch {
      // ignore logo embed errors
    }
  }

  const headerTextWidth = PAGE_WIDTH - textX - MARGIN;

  // Company Name
  const companyNameLines = wrapCellText(data.company.name.toUpperCase(), bold, 13, headerTextWidth);
  for (const line of companyNameLines) {
    currentPage.drawText(line, { x: textX, y, size: 13, font: bold, color: DARK });
    y -= 15;
  }

  // Company Address
  if (data.company.address) {
    const addrLines = wrapCellText(data.company.address, font, 8.5, headerTextWidth);
    for (const line of addrLines) {
      currentPage.drawText(line, { x: textX, y, size: 8.5, font, color: GREY });
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
    const contactLines = wrapCellText(contactLine, font, 8.5, headerTextWidth);
    for (const line of contactLines) {
      currentPage.drawText(line, { x: textX, y, size: 8.5, font, color: GREY });
      y -= 11;
    }
  }

  y -= 4;

  // Top Rule
  currentPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: DARK,
  });
  y -= 15;

  // Document Title
  const title = "DELIVERY CHALLAN";
  const titleWidth = getTextWidth(title, bold, 13);
  currentPage.drawText(title, { x: (PAGE_WIDTH - titleWidth) / 2, y, size: 13, font: bold, color: DARK });
  y -= 11;

  // Sub-rule under title
  currentPage.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.75,
    color: LINE,
  });
  y -= 14;

  // ================= 2. DOCUMENT IDENTIFICATION & VENDOR / PROCESS GRID =================
  const splitX = MARGIN + CONTENT_WIDTH * 0.55;
  const leftColW = splitX - MARGIN - 16;
  const rightValX = splitX + 90;
  const rightValW = (PAGE_WIDTH - MARGIN) - rightValX - 8;

  // Prepare Left Column Wrapped Content
  const vendorNameLines = wrapCellText(data.vendorName || "—", bold, 9.5, leftColW);
  const vendorAddrLines = wrapCellText(data.vendorAddress || "", font, 8, leftColW);
  const vendorTaxLine = [
    data.vendorGst ? "GST: " + data.vendorGst : "",
    data.vendorPan ? "PAN: " + data.vendorPan : "",
  ]
    .filter(Boolean)
    .join("  |  ");
  const vendorTaxLines = wrapCellText(vendorTaxLine, font, 8, leftColW);

  const leftContentHeight =
    12 +
    vendorNameLines.length * 12 +
    (vendorAddrLines.length > 0 ? vendorAddrLines.length * 10 : 0) +
    (vendorTaxLines.length > 0 ? vendorTaxLines.length * 10 : 0) +
    12;

  // Prepare Right Column Wrapped Content
  const idPairs: { label: string; val: string; isBold: boolean }[] = [
    { label: "DC Number:", val: data.dcNumber, isBold: true },
    { label: "DC Date:", val: data.dcDate, isBold: false },
    { label: "Work Order No:", val: data.woNumber, isBold: false },
    { label: "Process:", val: data.processName, isBold: true },
    { label: "Purpose:", val: data.purpose, isBold: false },
    { label: "Expected Return:", val: data.expectedReturnDate, isBold: false },
  ];

  const preparedRightPairs = idPairs.map((p) => {
    const wrapped = wrapCellText(p.val || "—", p.isBold ? bold : font, p.isBold ? 8.5 : 8, rightValW);
    return { ...p, wrapped };
  });

  const rightContentHeight =
    12 +
    preparedRightPairs.reduce((acc, p) => acc + Math.max(14, p.wrapped.length * 11), 0) +
    8;

  const headerBoxHeight = Math.max(105, leftContentHeight, rightContentHeight);

  ensureSpace(headerBoxHeight + 14);

  const boxTopY = y;

  // Outer Border Box for Header Data
  currentPage.drawRectangle({
    x: MARGIN,
    y: boxTopY - headerBoxHeight,
    width: CONTENT_WIDTH,
    height: headerBoxHeight,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  // Vertical Splitter Line
  currentPage.drawLine({
    start: { x: splitX, y: boxTopY },
    end: { x: splitX, y: boxTopY - headerBoxHeight },
    thickness: 0.75,
    color: LINE,
  });

  // Render Left Column
  let leftY = boxTopY - 12;
  currentPage.drawText("CONSIGNEE / VENDOR DETAILS", { x: MARGIN + 8, y: leftY, size: 7.5, font: bold, color: LIGHT_GREY });
  leftY -= 13;

  for (const line of vendorNameLines) {
    currentPage.drawText(line, { x: MARGIN + 8, y: leftY, size: 9.5, font: bold, color: DARK });
    leftY -= 12;
  }

  for (const line of vendorAddrLines) {
    currentPage.drawText(line, { x: MARGIN + 8, y: leftY, size: 8, font, color: GREY });
    leftY -= 10;
  }

  for (const line of vendorTaxLines) {
    currentPage.drawText(line, { x: MARGIN + 8, y: leftY, size: 8, font, color: GREY });
    leftY -= 10;
  }

  // Render Right Column
  let rightY = boxTopY - 12;
  const rightPad = splitX + 8;

  for (const pair of preparedRightPairs) {
    currentPage.drawText(pair.label, { x: rightPad, y: rightY, size: 8, font, color: GREY });
    const f = pair.isBold ? bold : font;
    const s = pair.isBold ? 8.5 : 8;
    const lh = 11;
    pair.wrapped.forEach((wLine, idx) => {
      currentPage.drawText(wLine, {
        x: rightValX,
        y: rightY - idx * lh,
        size: s,
        font: f,
        color: DARK,
      });
    });
    rightY -= Math.max(14, pair.wrapped.length * lh);
  }

  y = boxTopY - headerBoxHeight - 14;

  // ================= 3. MATERIAL DETAILS SECTION =================
  const tableHeaderHeight = 20;

  // Table Columns Width
  const col1W = CONTENT_WIDTH * 0.24;
  const col2W = CONTENT_WIDTH * 0.16;
  const col3W = CONTENT_WIDTH * 0.16;
  const col4W = CONTENT_WIDTH * 0.18;
  const col5W = CONTENT_WIDTH * 0.26;

  const c1X = MARGIN;
  const c2X = c1X + col1W;
  const c3X = c2X + col2W;
  const c4X = c3X + col3W;
  const c5X = c4X + col4W;

  const partLines = wrapCellText(data.partNumber || "—", bold, 8.5, col1W - 16);
  const rmLines = wrapCellText(data.rmQuantity || "—", bold, 8.5, col2W - 16);
  const fgLines = wrapCellText(data.returnFgQuantity || "—", bold, 8.5, col3W - 16);
  const weightLines = wrapCellText(data.weightKg || "—", bold, 8.5, col4W - 16);
  const heatLines = wrapCellText(data.heatNumber || "—", bold, 8.5, col5W - 16);

  const maxLines = Math.max(1, partLines.length, rmLines.length, fgLines.length, weightLines.length, heatLines.length);
  const lineHeight = 11;
  const dataRowHeight = Math.max(28, 14 + maxLines * lineHeight);

  ensureSpace(tableHeaderHeight + dataRowHeight + 12);

  const tableHeaderY = y;

  // Table Header Background
  currentPage.drawRectangle({
    x: MARGIN,
    y: tableHeaderY - tableHeaderHeight,
    width: CONTENT_WIDTH,
    height: tableHeaderHeight,
    color: TABLE_BG,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  // Table Header Labels
  currentPage.drawText("PART NUMBER", { x: c1X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });
  currentPage.drawText("RM QTY (RAW MAT.)", { x: c2X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });
  currentPage.drawText("RETURN FG QTY", { x: c3X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });
  currentPage.drawText("WEIGHT (KG)", { x: c4X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });
  currentPage.drawText("HEAT NUMBER", { x: c5X + 8, y: tableHeaderY - 14, size: 8, font: bold, color: DARK });

  // Column Separators for Header
  [c2X, c3X, c4X, c5X].forEach((colX) => {
    currentPage.drawLine({
      start: { x: colX, y: tableHeaderY },
      end: { x: colX, y: tableHeaderY - tableHeaderHeight },
      thickness: 0.75,
      color: LINE,
    });
  });

  // Table Data Row
  const dataRowY = tableHeaderY - tableHeaderHeight;

  currentPage.drawRectangle({
    x: MARGIN,
    y: dataRowY - dataRowHeight,
    width: CONTENT_WIDTH,
    height: dataRowHeight,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  const startTextY = dataRowY - 13;

  partLines.forEach((line, idx) => {
    currentPage.drawText(line, { x: c1X + 8, y: startTextY - idx * lineHeight, size: 8.5, font: bold, color: DARK });
  });
  rmLines.forEach((line, idx) => {
    currentPage.drawText(line, { x: c2X + 8, y: startTextY - idx * lineHeight, size: 8.5, font: bold, color: DARK });
  });
  fgLines.forEach((line, idx) => {
    currentPage.drawText(line, { x: c3X + 8, y: startTextY - idx * lineHeight, size: 8.5, font: bold, color: DARK });
  });
  weightLines.forEach((line, idx) => {
    currentPage.drawText(line, { x: c4X + 8, y: startTextY - idx * lineHeight, size: 8.5, font: bold, color: DARK });
  });
  heatLines.forEach((line, idx) => {
    currentPage.drawText(line, { x: c5X + 8, y: startTextY - idx * lineHeight, size: 8.5, font: bold, color: DARK });
  });

  // Column Separators for Data Row
  [c2X, c3X, c4X, c5X].forEach((colX) => {
    currentPage.drawLine({
      start: { x: colX, y: dataRowY },
      end: { x: colX, y: dataRowY - dataRowHeight },
      thickness: 0.75,
      color: LINE,
    });
  });

  y = dataRowY - dataRowHeight - 12;

  // ================= 4. PRICING & COMMERCIAL TERMS BLOCK =================
  const pColW = CONTENT_WIDTH / 3;
  const pAvailW = pColW - 12;

  const pricingRaw: [string, string][] = [
    ["PRICING BASIS", data.pricingBasis || "—"],
    ["RATE PER QUANTITY", data.ratePerQuantity && data.ratePerQuantity !== "—" ? `INR ${data.ratePerQuantity}` : "—"],
    ["EXPECTED TOTAL AMOUNT", data.expectedAmount && data.expectedAmount !== "—" ? `INR ${data.expectedAmount}` : "—"],
  ];

  const pricingPrepared = pricingRaw.map(([label, val]) => {
    const lines = wrapCellText(val || "—", bold, 8, pAvailW);
    return { label, val, lines };
  });

  const maxPriceLines = Math.max(1, ...pricingPrepared.map((p) => p.lines.length));
  const priceBoxHeight = Math.max(32, 16 + maxPriceLines * 10);

  ensureSpace(priceBoxHeight + 12);

  const priceBoxTop = y;

  currentPage.drawRectangle({
    x: MARGIN,
    y: priceBoxTop - priceBoxHeight,
    width: CONTENT_WIDTH,
    height: priceBoxHeight,
    color: rgb(0.96, 0.98, 1.0),
    borderColor: LINE,
    borderWidth: 0.75,
  });

  pricingPrepared.forEach(({ label, lines }, idx) => {
    const px = MARGIN + idx * pColW;
    currentPage.drawText(label, { x: px + 6, y: priceBoxTop - 11, size: 6.5, font: bold, color: LIGHT_GREY });
    lines.forEach((line, lIdx) => {
      currentPage.drawText(line, { x: px + 6, y: priceBoxTop - 22 - lIdx * 10, size: 8, font: bold, color: DARK });
    });

    if (idx > 0) {
      currentPage.drawLine({
        start: { x: px, y: priceBoxTop },
        end: { x: px, y: priceBoxTop - priceBoxHeight },
        thickness: 0.75,
        color: LINE,
      });
    }
  });

  y = priceBoxTop - priceBoxHeight - 12;

  // ================= 5. TRANSPORT & COMPLIANCE DETAILS =================
  const tColW = CONTENT_WIDTH / 4;
  const tAvailW = tColW - 12;

  const transportRaw: [string, string][] = [
    ["VEHICLE NO.", data.vehicleNumber],
    ["TRANSPORTER", data.transporter],
    ["E-WAY BILL NO.", data.ewayBillNumber],
    ["E-SUGAM / REF NO.", [data.eSugamNumber, data.referenceNumber].filter((v) => v && v !== "—").join(" / ") || "—"],
  ];

  const transportPrepared = transportRaw.map(([label, val]) => {
    const lines = wrapCellText(val || "—", font, 8, tAvailW);
    return { label, val, lines };
  });

  const maxTransLines = Math.max(1, ...transportPrepared.map((t) => t.lines.length));
  const transportBoxHeight = Math.max(34, 16 + maxTransLines * 10);

  ensureSpace(transportBoxHeight + 14);

  const transportBoxTop = y;

  currentPage.drawRectangle({
    x: MARGIN,
    y: transportBoxTop - transportBoxHeight,
    width: CONTENT_WIDTH,
    height: transportBoxHeight,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  transportPrepared.forEach(({ label, lines }, idx) => {
    const tx = MARGIN + idx * tColW;
    currentPage.drawText(label, { x: tx + 6, y: transportBoxTop - 11, size: 6.5, font: bold, color: LIGHT_GREY });
    lines.forEach((line, lIdx) => {
      currentPage.drawText(line, { x: tx + 6, y: transportBoxTop - 22 - lIdx * 10, size: 8, font, color: DARK });
    });

    if (idx > 0) {
      currentPage.drawLine({
        start: { x: tx, y: transportBoxTop },
        end: { x: tx, y: transportBoxTop - transportBoxHeight },
        thickness: 0.75,
        color: LINE,
      });
    }
  });

  y = transportBoxTop - transportBoxHeight - 14;

  // ================= 6. REMARKS SECTION =================
  const remarksText = data.remarks?.trim() || "";
  const remarksLines = wrapCellText(remarksText, font, 8.5, CONTENT_WIDTH - 16);
  const remarksBoxHeight = Math.max(36, 18 + (remarksLines.length > 0 ? remarksLines.length * 10 : 10));

  ensureSpace(remarksBoxHeight + 14);

  const remarksBoxTop = y;

  currentPage.drawRectangle({
    x: MARGIN,
    y: remarksBoxTop - remarksBoxHeight,
    width: CONTENT_WIDTH,
    height: remarksBoxHeight,
    borderColor: LINE,
    borderWidth: 0.75,
  });

  currentPage.drawText("REMARKS / INSTRUCTIONS", { x: MARGIN + 8, y: remarksBoxTop - 11, size: 7, font: bold, color: LIGHT_GREY });

  if (remarksLines.length > 0) {
    let ry = remarksBoxTop - 22;
    for (const line of remarksLines) {
      currentPage.drawText(line, { x: MARGIN + 8, y: ry, size: 8.5, font, color: DARK });
      ry -= 10;
    }
  } else {
    currentPage.drawText("NIL", { x: MARGIN + 8, y: remarksBoxTop - 22, size: 8.5, font, color: GREY });
  }

  y = remarksBoxTop - remarksBoxHeight - 14;

  // ================= 7. TERMS & CONDITIONS =================
  const termsText =
    "TERMS & CONDITIONS: Material listed above is dispatched for job work processing only and remains the sole property of " +
    data.company.name +
    ". The consignee/receiving party is responsible for safe custody and return of the processed material along with any finished goods / scrap generated as per agreed terms.";

  const termsLines = wrapCellText(termsText, font, 7, CONTENT_WIDTH);
  const termsTotalHeight = termsLines.length * 9;

  ensureSpace(termsTotalHeight + 10);

  for (const line of termsLines) {
    currentPage.drawText(line, { x: MARGIN, y, size: 7, font, color: LIGHT_GREY });
    y -= 9;
  }

  // ================= 8. SIGNATURE SECTION & QR CODE =================
  const footerY = 55;
  const signBoxWidth = (CONTENT_WIDTH - 70) / 4;

  const signBlocks: { label: string; name: string | null }[] = [
    { label: "Prepared By", name: data.preparedByName || null },
    { label: "Approved By", name: data.approvedByName || null },
    { label: "Receiver Signature", name: null },
    { label: "Authorized Signature", name: null },
  ];

  signBlocks.forEach((block, idx) => {
    const sx = MARGIN + idx * signBoxWidth;

    if (block.name) {
      const nameLines = wrapCellText(block.name, bold, 8, signBoxWidth - 12);
      if (nameLines[0]) {
        currentPage.drawText(nameLines[0], { x: sx, y: footerY + 22, size: 8, font: bold, color: DARK });
      }
    }

    currentPage.drawLine({
      start: { x: sx, y: footerY + 14 },
      end: { x: sx + signBoxWidth - 12, y: footerY + 14 },
      thickness: 0.75,
      color: LINE,
    });

    currentPage.drawText(block.label, { x: sx, y: footerY, size: 7.5, font, color: GREY });
  });

  // Embedded QR Code (Bottom Right)
  if (data.qrDataUrl && data.qrDataUrl.startsWith("data:image/png;base64,")) {
    try {
      const base64 = data.qrDataUrl.split(",")[1];
      const qrBytes = Buffer.from(base64, "base64");
      const qrImage = await pdfDoc.embedPng(qrBytes);
      const qrSize = 54;
      const qrX = PAGE_WIDTH - MARGIN - qrSize;
      currentPage.drawImage(qrImage, { x: qrX, y: footerY + 2, width: qrSize, height: qrSize });
      const caption = "Scan to verify";
      currentPage.drawText(caption, {
        x: qrX + (qrSize - getTextWidth(caption, font, 6)) / 2,
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