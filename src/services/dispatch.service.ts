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

/**
 * Builds the absolute URL a scanned QR code should resolve to.
 * Falls back to a relative path if no base URL is configured, so this still
 * works before deployment env vars are set (dev / this sandbox).
 */
export function buildDcQrUrl(dcId: string): string {
  const base = process.env.APP_URL || process.env.NEXTAUTH_URL;
  const path = `/dcs/${dcId}`;
  return base ? new URL(path, base).toString() : path;
}