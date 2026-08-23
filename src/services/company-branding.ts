import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";

const LOGO_SETTING_KEY = "companyLogo";

function extToMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    default: return "";
  }
}

async function toEmbeddableDataUrl(mime: string, buf: Buffer): Promise<string> {
  if (mime === "image/png" || mime === "image/jpeg") {
    return `data:${mime};base64,${buf.toString("base64")}`;
  }
  // WebP/other formats: convert to PNG so pdf-lib can embed them
  const sharp = (await import("sharp")).default;
  const png = await sharp(buf).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * Resolves the company logo as a data URL for use in PDFs and web views.
 * Priority:
 *   1. SystemSetting "companyLogo" holding a data URL (data:image/...)
 *   2. SystemSetting "companyLogo" holding an absolute http(s) URL
 *   3. A file dropped at <project>/public/company-logo.(png|jpg|jpeg|webp)
 */
export async function getCompanyLogoDataUrl(): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: LOGO_SETTING_KEY } }).catch(() => null);
  const value = row?.value?.trim();

  if (value) {
    if (value.startsWith("data:image/")) return value;

    if (/^https?:\/\//i.test(value)) {
      try {
        const res = await fetch(value);
        if (res.ok) {
          const mime = res.headers.get("content-type")?.split(";")[0] ?? "";
          if (mime.startsWith("image/")) {
            const buf = Buffer.from(await res.arrayBuffer());
            return await toEmbeddableDataUrl(mime, buf);
          }
        }
      } catch {
        // fall through to local file fallback
      }
    }
  }

  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    try {
      const buf = await readFile(path.join(process.cwd(), "public", `company-logo${ext}`));
      const mime = extToMime(ext);
      if (mime) return await toEmbeddableDataUrl(mime, buf);
    } catch {
      // try next extension
    }
  }

  return null;
}
