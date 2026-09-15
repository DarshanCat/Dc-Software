/**
 * Resolves the NextAuth JWT signing secret from the environment.
 *
 * - Production: the secret MUST be configured via NEXTAUTH_SECRET. Missing it is
 *   a hard failure (fail-closed) so the app can never fall back to a predictable,
 *   known signing key.
 * - Non-production: a clearly-marked dev-only fallback is used so local/dev
 *   environments work without configuration. It is never used in production.
 */
export function resolveNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && secret.trim().length > 0) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET must be configured in the production environment.");
  }
  return "dev-only-insecure-secret-never-use-in-production";
}