import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission } from "@/server/authorize";

vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryChallan: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    statusHistory: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    permission: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    role: {
      upsert: vi.fn(),
    },
    rolePermission: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg(prisma);
    }),
  },
}));

vi.mock("@/server/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/server/authorize", () => ({
  requirePermission: vi.fn().mockResolvedValue(true),
  hasPermission: vi.fn().mockResolvedValue(true),
  ForbiddenError: class ForbiddenError extends Error {},
  UnauthenticatedError: class UnauthenticatedError extends Error {},
}));

vi.mock("@/server/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

vi.mock("@/server/notifications/service", () => ({
  notifyUsersWithPermission: vi.fn().mockResolvedValue([]),
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { resolveNextAuthSecret } from "@/lib/nextauth-secret";
import { POST as bootstrapPost } from "@/app/api/bootstrap-admin/route";
import {
  reviewPreOutwardManagerApproval,
  reviewManagerApproval,
} from "@/server/dcs/extended-actions";
import {
  submitSecurityDispatch,
  submitSecurityReturn,
  submitStoreVerification,
  submitAccountsPaymentEntry,
  updateDcTransportDetails,
} from "@/server/dcs/actions";
import { firstIssueMessage, securityDispatchSchema, transportDetailsSchema } from "@/lib/validation/dc";

const originalEnv: Record<string, string | undefined> = {};

function postToRoute(body: unknown, headers: Record<string, string> = {}) {
  return bootstrapPost(
    new Request("http://localhost/api/bootstrap-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "undefined" ? "" : JSON.stringify(body),
    }),
  );
}

describe("F-1: Fail-Closed NextAuth Secret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured NEXTAUTH_SECRET when set", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "real-production-secret");
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveNextAuthSecret()).toBe("real-production-secret");
  });

  it("throws in production when NEXTAUTH_SECRET is missing (no insecure fallback)", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => resolveNextAuthSecret()).toThrow(/NEXTAUTH_SECRET/);
  });

  it("returns an explicit dev-only fallback outside production (never silently empty)", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    const secret = resolveNextAuthSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
    expect(secret).toContain("dev-only");
  });
});

describe("E-1: Bootstrap Admin Endpoint Hardening", () => {
  const ORIGINAL = { BOOTSTRAP_ADMIN_TOKEN: process.env.BOOTSTRAP_ADMIN_TOKEN, APP_URL: process.env.APP_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BOOTSTRAP_ADMIN_TOKEN = ORIGINAL.BOOTSTRAP_ADMIN_TOKEN;
    delete process.env.APP_URL;
    delete process.env.NEXTAUTH_URL;
  });

  afterEach(() => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = ORIGINAL.BOOTSTRAP_ADMIN_TOKEN;
    process.env.APP_URL = ORIGINAL.APP_URL;
    process.env.NEXTAUTH_URL = ORIGINAL.NEXTAUTH_URL;
  });

  it("returns 403 when BOOTSTRAP_ADMIN_TOKEN is not configured (disabled by default)", async () => {
    delete process.env.BOOTSTRAP_ADMIN_TOKEN;
    const res = await postToRoute(
      { name: "A", email: "admin@vijayspheroidals.com", password: "Admin@1234" },
      { "x-forwarded-for": "1.1.1.1" },
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Setup is not available.");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("returns 403 when the submitted setupToken does not match", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = "correct-horse-battery-staple";
    const res = await postToRoute(
      { name: "A", email: "admin@vijayspheroidals.com", password: "Admin@1234", setupToken: "wrong-token" },
      { "x-forwarded-for": "1.1.1.2" },
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Setup is not available.");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a payload that fails zod validation (weak password)", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = "correct-horse-battery-staple";
    const res = await postToRoute(
      { name: "A", email: "admin@vijayspheroidals.com", password: "weak", setupToken: "correct-horse-battery-staple" },
      { "x-forwarded-for": "1.1.1.3" },
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when the Origin does not match the deployment origin", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = "correct-horse-battery-staple";
    process.env.APP_URL = "https://app.example.com";
    const res = await postToRoute(
      { name: "A", email: "admin@vijayspheroidals.com", password: "Admin@1234", setupToken: "correct-horse-battery-staple" },
      { "x-forwarded-for": "1.1.1.4", origin: "https://evil.example.com", host: "app.example.com" },
    );
    expect(res.status).toBe(403);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rate-limits per-IP after 5 attempts within 15 minutes", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = "correct-horse-battery-staple";
    let lastStatus = 0;
    for (let i = 0; i < 6; i += 1) {
      const res = await postToRoute(undefined, { "x-forwarded-for": "9.9.9.9" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("bootstraps the first administrator on a valid secure request", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = "correct-horse-battery-staple";

    vi.mocked(prisma.user.count).mockResolvedValue(0);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.permission.upsert).mockResolvedValue({ id: "perm-1" } as any);
    vi.mocked(prisma.permission.findUnique).mockResolvedValue({ id: "perm-1" } as any);
    vi.mocked(prisma.role.upsert).mockResolvedValue({ id: "role-1", key: "ADMIN" } as any);
    vi.mocked(prisma.rolePermission.upsert).mockResolvedValue({ id: "rp-1" } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1", email: "admin@vijayspheroidals.com" } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log-1" } as any);

    const res = await postToRoute(
      {
        name: "First Admin",
        email: "admin@vijayspheroidals.com",
        password: "Admin@1234",
        setupToken: "correct-horse-battery-staple",
      },
      { "x-forwarded-for": "1.1.1.9" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "admin@vijayspheroidals.com" }) }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("B-1: Fail-Closed Manager Approval Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionUser).mockResolvedValue({
      id: "mgr-1",
      email: "mgr@factory.com",
      roleKeys: ["MANAGEMENT"],
    } as any);
  });

  it("rejects an unsupported action in reviewPreOutwardManagerApproval WITHOUT touching prisma", async () => {
    const res = await reviewPreOutwardManagerApproval({
      dcId: "dc-1",
      action: "SIDESTEP_APPROVAL" as any,
    });
    expect(res).toEqual({ ok: false, error: "Invalid approval action." });
    expect(prisma.deliveryChallan.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unsupported action in reviewManagerApproval WITHOUT touching prisma", async () => {
    const res = await reviewManagerApproval({
      dcId: "dc-1",
      action: "GRANT_PAYMENT" as any,
    });
    expect(res).toEqual({ ok: false, error: "Invalid approval action." });
    expect(prisma.deliveryChallan.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("still approves a valid APPROVE action (no regression)", async () => {
    vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
      id: "dc-1",
      status: "STORE_VERIFIED",
      movementType: "MATERIAL",
    } as any);
    vi.mocked(prisma.deliveryChallan.update).mockResolvedValue({ id: "dc-1" } as any);
    vi.mocked(prisma.statusHistory.create).mockResolvedValue({ id: "sh-1" } as any);

    const res = await reviewManagerApproval({ dcId: "dc-1", action: "APPROVE", approvalRemarks: "ok" });
    expect(res.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe("B-2: DC Transition Input Validation", () => {
  const admin = { id: "admin-1", email: "admin@factory.com", roleKeys: ["ADMIN"] } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionUser).mockResolvedValue(admin);
  });

  it("blocks NaN in submitSecurityDispatch before any prisma activity", async () => {
    const res = await submitSecurityDispatch("dc-1", { dispatchQuantity: NaN } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Dispatch quantity must be greater than zero.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks Infinity in submitSecurityReturn", async () => {
    const res = await submitSecurityReturn("dc-1", { actualInwardQty: Infinity } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Actual Inward Quantity must be greater than zero.");
  });

  it("blocks negative storeReceivedQty in submitStoreVerification", async () => {
    const res = await submitStoreVerification("dc-1", { storeReceivedQty: -5 } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Store Received Quantity must be greater than zero.");
  });

  it("blocks NaN invoiceAmount in submitAccountsPaymentEntry", async () => {
    const res = await submitAccountsPaymentEntry("dc-1", {
      invoiceNumber: "INV-1",
      invoiceDate: "2026-09-04",
      invoiceAmount: NaN,
      paymentReferenceNumber: "UTR-1",
      paymentDate: "2026-09-04",
    } as any);
    expect(res.ok).toBe(false);
    expect(prisma.deliveryChallan.update).not.toHaveBeenCalled();
  });

  it("blocks overlong vehicleNumber in updateDcTransportDetails", async () => {
    const res = await updateDcTransportDetails("dc-1", { vehicleNumber: "X".repeat(60) });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Vehicle number is invalid.");
  });

  it("blocks NaN actualInwardQty in recordInwardReceipt (extended-actions)", async () => {
    const { recordInwardReceipt } = await import("@/server/dcs/extended-actions");
    const res = await recordInwardReceipt({ dcId: "dc-1", actualInwardQty: NaN } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Actual Inward Quantity must be greater than zero.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks NaN goodQty in submitQualityInspection", async () => {
    const { submitQualityInspection } = await import("@/server/dcs/extended-actions");
    const res = await submitQualityInspection({
      dcId: "dc-1",
      goodQty: NaN,
      rejectionQty: 0,
      scrapQty: 0,
      qualityDecision: "PASSED",
    } as any);
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks NaN ratePerQuantity in createOutwardDc", async () => {
    const { createOutwardDc } = await import("@/server/dcs/extended-actions");
    const res = await createOutwardDc({
      vendorId: "vendor-1",
      pricingBasis: "RW",
      ratePerQuantity: NaN,
    } as any);
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.error).toBe("Rate Per Quantity must be a valid number.");
  });

  it("still accepts a valid security return (no regression)", async () => {
    vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
      id: "dc-1",
      dcNumber: "DC-2026-0001",
      status: "AT_VENDOR",
      invoiceNumber: "INV-1",
    } as any);
    vi.mocked(prisma.deliveryChallan.update).mockResolvedValue({ id: "dc-1" } as any);
    vi.mocked(prisma.statusHistory.create).mockResolvedValue({ id: "sh-1" } as any);

    const res = await submitSecurityReturn("dc-1", {
      actualInwardQty: 50,
      inwardDate: "2026-09-04",
      vehicleNumber: "KA-01-1234",
    });
    expect(res.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  describe("validation module direct checks", () => {
    it("firstIssueMessage flags NaN/Infinity for the numeric guards", () => {
      expect(firstIssueMessage(securityDispatchSchema, { dispatchQuantity: NaN })).toBe(
        "Dispatch quantity must be greater than zero.",
      );
      expect(firstIssueMessage(securityDispatchSchema, { dispatchQuantity: Infinity })).toBe(
        "Dispatch quantity must be greater than zero.",
      );
      expect(firstIssueMessage(securityDispatchSchema, { dispatchQuantity: 0 })).toBe(
        "Dispatch quantity must be greater than zero.",
      );
      expect(firstIssueMessage(securityDispatchSchema, { dispatchQuantity: 2_000_000_000 })).toBe(
        "Dispatch quantity must be greater than zero.",
      );
    });

    it("firstIssueMessage flags overlong text fields", () => {
      expect(firstIssueMessage(transportDetailsSchema, { vehicleNumber: "X".repeat(60) })).toBe(
        "Vehicle number is invalid.",
      );
    });

    it("firstIssueMessage flags unparseable dates", () => {
      expect(firstIssueMessage(securityDispatchSchema, { dispatchQuantity: 5, dispatchDate: "not-a-date" })).toBe(
        "Dispatch date is invalid.",
      );
    });
  });
});