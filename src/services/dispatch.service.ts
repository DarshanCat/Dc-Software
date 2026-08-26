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

function getValidBaseUrl(): string | null {
  const base = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (!base || base.includes("SENSITIVE") || base.includes("[") || base.includes("]")) {
    return null;
  }
  return base;
}

/**
 * Builds the absolute URL a scanned QR code should resolve to.
 * Falls back to a relative path if no base URL is configured, so this still
 * works before deployment env vars are set (dev / this sandbox).
 */
export function buildDcQrUrl(dcId: string): string {
  const base = getValidBaseUrl();
  const path = `/dcs/${dcId}`;
  if (!base) return path;
  try {
    return new URL(path, base.startsWith("http") ? base : `https://${base}`).toString();
  } catch {
    return path;
  }
}

/**
 * Public, unauthenticated URL the printed QR code should encode (spec §21).
 * Keyed by the opaque qrToken, not the internal DC id — anyone who scans it
 * gets a PDF view/download with no login required. Never put business data
 * in the QR itself, only this token-secured link.
 */
export function buildDcPublicUrl(qrToken: string): string {
  const base = getValidBaseUrl();
  const path = `/public/dc/${qrToken}`;
  if (!base) return path;
  try {
    return new URL(path, base.startsWith("http") ? base : `https://${base}`).toString();
  } catch {
    return path;
  }
}