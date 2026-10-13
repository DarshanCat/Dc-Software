import { randomBytes } from "crypto";

/**
 * Generates a cryptographically random, URL-safe QR token for a dispatched DC.
 * The token itself carries no business information (no DC number, vendor, weight, etc.) —
 * it is purely an opaque identifier used to look up the DC server-side after a scan.
 * (spec §21: "The QR should contain a secure identifier, not sensitive business information.")
 */
export function generateQrToken(): string {
  return randomBytes(24).toString("base64url");
}

function getValidBaseUrl(): string {
  const base =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    process.env.NEXTAUTH_URL ||
    "https://dc.vijayspheroidals.in";
  if (!base || base.includes("SENSITIVE") || base.includes("[") || base.includes("]") || base.includes("localhost")) {
    return "https://dc.vijayspheroidals.in";
  }
  return base.startsWith("http") ? base : `https://${base}`;
}

/**
 * Builds the absolute URL a scanned QR code should resolve to.
 */
export function buildDcQrUrl(dcIdOrToken: string): string {
  const base = getValidBaseUrl();
  const path = `/qr/${encodeURIComponent(dcIdOrToken)}`;
  try {
    return new URL(path, base).toString();
  } catch {
    return `${base}${path}`;
  }
}

/**
 * Public, unauthenticated URL the printed QR code should encode (spec §21).
 * Keyed by the opaque qrToken, not the internal DC id — anyone who scans it
 * gets the digital DC softcopy on mobile with full details and instant PDF download.
 */
export function buildDcPublicUrl(qrToken: string): string {
  const base = getValidBaseUrl();
  const path = `/qr/${encodeURIComponent(qrToken)}`;
  try {
    return new URL(path, base).toString();
  } catch {
    return `${base}${path}`;
  }
}