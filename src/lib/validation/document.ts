export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type SupportedDocType = "pdf" | "jpg" | "png" | "xlsx" | "csv" | "dwg" | "dxf";

const SIGNATURES: { type: SupportedDocType; bytes: number[] }[] = [
  { type: "pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { type: "xlsx", bytes: [0x50, 0x4b, 0x03, 0x04] },
  // AutoCAD DWG binaries start with a version tag: "AC1012"…"AC1032"
  { type: "dwg", bytes: [0x41, 0x43, 0x31] },
];

function matchesSignature(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[i] !== bytes[i]) return false;
  }
  return true;
}

export function detectFileType(buffer: Buffer, fileName: string): SupportedDocType | null {
  for (const sig of SIGNATURES) {
    if (matchesSignature(buffer, sig.bytes)) return sig.type;
  }

  if (fileName.toLowerCase().endsWith(".csv") || fileName.toLowerCase().endsWith(".dxf")) {
    const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
    const hasNullByte = sample.includes(0);
    if (!hasNullByte) return fileName.toLowerCase().endsWith(".dxf") ? "dxf" : "csv";
  }

  return null;
}

export function validateUpload(
  buffer: Buffer,
  fileName: string,
): { ok: true; type: SupportedDocType } | { ok: false; error: string } {
  if (buffer.length === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "File exceeds the 10 MB limit." };
  }
  const type = detectFileType(buffer, fileName);
  if (!type) {
    return { ok: false, error: "Unsupported or unrecognized file type. Allowed: PDF, JPG, PNG, XLSX, CSV, DWG, DXF." };
  }
  return { ok: true, type };
}