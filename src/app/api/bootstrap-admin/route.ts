import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "@/config/permissions";
import { companyEmailSchema } from "@/lib/validation/registration";
import { passwordPolicy } from "@/lib/validation/user";

/**
 * E-1 Security Hardening for the one-time bootstrap endpoint.
 *
 * - Endpoint is inert unless BOOTSTRAP_ADMIN_TOKEN is configured in the
 *   environment, preventing unplanned account creation on a fresh deploy.
 * - The configured token must be supplied in the body and is compared using a
 *   timing-safe SHA-256 digest comparison.
 * - Cross-site requests are rejected via Origin / Host validation.
 * - A per-IP rate limiter (5 attempts / 15 minutes) limits brute force.
 * - Payload is validated with zod (company email domain + password policy).
 * - All failures return generic messages; no internal error.message is leaked.
 */

const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

function bootstrapToken(): string | null {
  const token = process.env.BOOTSTRAP_ADMIN_TOKEN;
  return token && token.trim().length > 0 ? token : null;
}

function tokenMatches(provided: string | undefined): boolean {
  const expected = bootstrapToken();
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(provided).digest();
  return timingSafeEqual(a, b);
}

function allowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  const configured: string[] = [process.env.APP_URL, process.env.NEXTAUTH_URL]
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .map((u) => u.replace(/\/+$/, ""));
  const normalize = (value: string | null) => (value || "").toLowerCase().replace(/\/+$/, "");
  const allowedHosts = new Set(configured.map((u) => normalize(new URL(u).host)));
  if (configured.length === 0) return true; // no deployment origin configured (dev)
  if (origin) {
    try {
      return allowedHosts.has(normalize(new URL(origin).host));
    } catch {
      return false;
    }
  }
  return allowedHosts.has(normalize(host));
}

const bootstrapSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name cannot exceed 120 characters."),
  email: companyEmailSchema,
  password: passwordPolicy,
  setupToken: z.string().min(1, "Setup token is required."),
});

export async function POST(req: Request) {
  try {
    if (!bootstrapToken()) {
      return NextResponse.json(
        { error: "Setup is not available." },
        { status: 403 },
      );
    }

    if (!allowedOrigin(req)) {
      return NextResponse.json(
        { error: "Setup is not available." },
        { status: 403 },
      );
    }

    if (isRateLimited(clientIp(req))) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const parsed = bootstrapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please review the submitted details." },
        { status: 400 },
      );
    }
    const { name, email, password, setupToken } = parsed.data;

    if (!tokenMatches(setupToken)) {
      return NextResponse.json(
        { error: "Setup is not available." },
        { status: 403 },
      );
    }

    // One-time bootstrap: refuse if an active ADMIN already exists.
    const existingAdminCount = await prisma.user.count({
      where: {
        active: true,
        roles: {
          some: {
            role: {
              key: "ADMIN",
            },
          },
        },
      },
    });

    if (existingAdminCount > 0) {
      return NextResponse.json(
        { error: "An active Administrator already exists. One-time bootstrap is disabled." },
        { status: 403 },
      );
    }

    // Avoid leaking unique-constraint exceptions for already-provisioned emails.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 400 },
      );
    }

    // Ensure permissions and ADMIN role exist
    const permissionKeys = Object.values(PERMISSIONS);
    for (const key of permissionKeys) {
      await prisma.permission.upsert({
        where: { key },
        create: { key },
        update: {},
      });
    }

    const adminRole = await prisma.role.upsert({
      where: { key: ROLES.ADMIN },
      create: { key: ROLES.ADMIN, name: "System Administrator", isSystem: true },
      update: {},
    });

    const grants = DEFAULT_ROLE_PERMISSIONS.ADMIN || [];
    for (const permKey of grants) {
      const permission = await prisma.permission.findUnique({ where: { key: permKey } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
          create: { roleId: adminRole.id, permissionId: permission.id },
          update: {},
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        passwordHash,
        active: true,
        mustChangePassword: false,
        roles: {
          create: {
            roleId: adminRole.id,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "FIRST_ADMIN_BOOTSTRAPPED",
        module: "System",
        entityType: "User",
        entityId: user.id,
        reason: `Initial System Administrator ${user.email} bootstrapped safely.`,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Initial Administrator account ${user.email} bootstrapped successfully.`,
    });
  } catch {
    return NextResponse.json(
      { error: "Bootstrap failed. Please try again later." },
      { status: 500 },
    );
  }
}