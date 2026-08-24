/**
 * Helper to safely sanitize and format CSV fields to prevent CSV Formula Injection (OWASP).
 * Prefixes fields starting with =, +, -, @, \t, or \r with a single quote (').
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}
