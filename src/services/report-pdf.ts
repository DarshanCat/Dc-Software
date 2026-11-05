import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { wrapCellText } from "./dc-pdf";

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const DARK = rgb(0.08, 0.12, 0.2);
const GREY = rgb(0.3, 0.35, 0.42);
const LINE = rgb(0.75, 0.8, 0.85);
const TABLE_BG = rgb(0.93, 0.95, 0.97);

export interface ReportPdfColumn {
  header: string;
  /** Fraction of CONTENT_WIDTH this column occupies; all columns' widths should sum to ~1. */
  width: number;
}

export interface ReportPdfOptions {
  title: string;
  subtitle?: string;
  columns: ReportPdfColumn[];
  rows: string[][];
}

/**
 * Generic landscape tabular report PDF - used for report exports (e.g. Tools
 * Currently With Vendor) that need a printable/attachable PDF alongside their
 * CSV export, distinct from the Delivery Challan document template in
 * dc-pdf.tsx.
 */
export async function renderReportPdf(options: ReportPdfOptions): Promise<Buffer> {
  const { title, subtitle, columns, rows } = options;
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const colWidths = columns.map((c) => c.width * CONTENT_WIDTH);
  const colX: number[] = [];
  let acc = MARGIN;
  for (const w of colWidths) {
    colX.push(acc);
    acc += w;
  }

  const headerRowHeight = 20;
  const lineHeight = 10;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawTitle = () => {
    currentPage.drawText(title, { x: MARGIN, y, size: 13, font: bold, color: DARK });
    y -= 16;
    if (subtitle) {
      currentPage.drawText(subtitle, { x: MARGIN, y, size: 8.5, font, color: GREY });
      y -= 14;
    }
    y -= 4;
  };

  const drawTableHeader = () => {
    currentPage.drawRectangle({
      x: MARGIN,
      y: y - headerRowHeight,
      width: CONTENT_WIDTH,
      height: headerRowHeight,
      color: TABLE_BG,
      borderColor: LINE,
      borderWidth: 0.75,
    });
    columns.forEach((col, idx) => {
      currentPage.drawText(col.header, { x: colX[idx] + 6, y: y - 14, size: 7.5, font: bold, color: DARK });
    });
    for (let i = 1; i < colX.length; i++) {
      currentPage.drawLine({ start: { x: colX[i], y }, end: { x: colX[i], y: y - headerRowHeight }, thickness: 0.75, color: LINE });
    }
    y -= headerRowHeight;
  };

  const MIN_Y = 50;
  const ensureSpace = (needed: number) => {
    if (y - needed < MIN_Y) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawTableHeader();
    }
  };

  // The tallest row block a single fresh page can ever hold (page height minus
  // the top margin, the table header, and the bottom reserve). A row taller
  // than this (e.g. a cell that char-wraps a very long unbroken string into
  // dozens of lines) must have its lines split across several page-sized
  // chunks instead of being drawn as one atomic block - otherwise ensureSpace
  // adds a single new page and the oversized row still runs off the bottom,
  // silently cutting off its later lines.
  const MAX_ROW_HEIGHT = PAGE_HEIGHT - MARGIN - headerRowHeight - MIN_Y;

  const drawRowChunk = (cellLineChunks: string[][], chunkHeight: number) => {
    ensureSpace(chunkHeight);
    currentPage.drawRectangle({ x: MARGIN, y: y - chunkHeight, width: CONTENT_WIDTH, height: chunkHeight, borderColor: LINE, borderWidth: 0.5 });
    cellLineChunks.forEach((lines, idx) => {
      lines.forEach((line, lIdx) => {
        currentPage.drawText(line, { x: colX[idx] + 6, y: y - 11 - lIdx * lineHeight, size: 7.5, font, color: DARK });
      });
    });
    for (let i = 1; i < colX.length; i++) {
      currentPage.drawLine({ start: { x: colX[i], y }, end: { x: colX[i], y: y - chunkHeight }, thickness: 0.5, color: LINE });
    }
    y -= chunkHeight;
  };

  drawTitle();
  drawTableHeader();

  for (const row of rows) {
    const cellLines = row.map((cell, idx) => wrapCellText(cell || "—", font, 7.5, colWidths[idx] - 10));
    const rowLineCount = Math.max(1, ...cellLines.map((l) => l.length));
    const rowHeight = Math.max(16, 6 + rowLineCount * lineHeight);

    if (rowHeight <= MAX_ROW_HEIGHT) {
      ensureSpace(rowHeight);
      drawRowChunk(cellLines, rowHeight);
      continue;
    }

    const linesPerChunk = Math.max(1, Math.floor((MAX_ROW_HEIGHT - 6) / lineHeight));
    for (let offset = 0; offset < rowLineCount; offset += linesPerChunk) {
      const chunkLineCount = Math.min(linesPerChunk, rowLineCount - offset);
      const chunkHeight = Math.max(16, 6 + chunkLineCount * lineHeight);
      const chunkCellLines = cellLines.map((lines) => lines.slice(offset, offset + chunkLineCount));
      drawRowChunk(chunkCellLines, chunkHeight);
    }
  }

  if (rows.length === 0) {
    currentPage.drawText("No records found.", { x: MARGIN + 6, y: y - 14, size: 8.5, font, color: GREY });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
