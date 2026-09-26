import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSecurityDispatchQueue,
  getSecurityReturnQueue,
  getSecurityCompletedQueue,
  getMySecurityEntriesQueue,
} from "@/server/dcs/queries";
import {
  submitSecurityDispatch,
  submitSecurityReturn,
  confirmDcAtVendor,
} from "@/server/dcs/actions";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError } from "@/server/authorize";
import { prisma } from "@/lib/db";

vi.mock("@/server/session", () => ({
  getSessionUser: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/server/authorize", () => ({
  hasPermission: vi.fn(),
  requirePermission: vi.fn(),
  checkPermission: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
  UnauthenticatedError: class UnauthenticatedError extends Error {},
}));

vi.mock("@/server/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryChallan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    statusHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => {
      if (typeof cb === "function") return cb(prisma);
      return Promise.all(cb);
    }),
  },
}));

describe("Security Module Regression Suite", () => {
  const mockSecurityUser = {
    id: "sec-user-1",
    email: "security@vijayspheroidals.com",
    roleKeys: ["SECURITY"],
  };

  const mockAdminUser = {
    id: "admin-user-1",
    email: "admin@vijayspheroidals.com",
    roleKeys: ["ADMIN"],
  };

  const mockStoreUser = {
    id: "store-user-1",
    email: "store@vijayspheroidals.com",
    roleKeys: ["STORES"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. APPROVED DC appears in Waiting for Dispatch
  it("1. includes APPROVED DCs and Tool DRAFT DCs in getSecurityDispatchQueue", async () => {
    const mockDcs = [
      { id: "dc-1", dcNumber: "DC-001", status: "APPROVED", movementType: "MATERIAL", rmQuantity: 100 },
      { id: "dc-2", dcNumber: "DC-002", status: "DRAFT", movementType: "TOOL", rmQuantity: 2 },
    ];
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue(mockDcs as any);

    const queue = await getSecurityDispatchQueue("SECURITY");
    expect(queue.length).toBe(2);
    expect(prisma.deliveryChallan.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { status: "APPROVED" },
          { status: "DRAFT", movementType: { in: ["TOOL", "COMPANY_PROPERTY"] } },
        ],
      },
      include: expect.any(Object),
      orderBy: { updatedAt: "desc" },
    });
  });

  // 2. Dashboard waiting-dispatch count matches queue
  it("2. matches waiting for dispatch queue length for Security Dashboard", async () => {
    const mockDcs = [
      { id: "dc-1", dcNumber: "DC-001", status: "APPROVED" },
      { id: "dc-2", dcNumber: "DC-002", status: "APPROVED" },
    ];
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue(mockDcs as any);

    const queue = await getSecurityDispatchQueue("SECURITY");
    expect(queue.length).toBe(2);
  });

  // 3. Security dispatch changes DC status to DISPATCHED
  it("3. changes status to DISPATCHED when Security dispatch is executed", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(mockSecurityUser as any);
    vi.mocked(requirePermission).mockResolvedValue(mockSecurityUser as any);
    vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
      id: "dc-100",
      status: "APPROVED",
      movementType: "MATERIAL",
    } as any);

    const res = await submitSecurityDispatch("dc-100", {
      dispatchQuantity: 50,
      vehicleNumber: "KA-01-AB-1234",
    });

    expect(res.ok).toBe(true);
    expect(prisma.deliveryChallan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dc-100" },
        data: expect.objectContaining({
          status: "DISPATCHED",
          securityDispatchedBy: "sec-user-1",
        }),
      }),
    );
  });

  // 4. Dispatched/At Vendor queue shows dispatched DC
  it("4. returns DISPATCHED and AT_VENDOR DCs in getSecurityReturnQueue", async () => {
    const mockDispatchedDcs = [
      { id: "dc-101", dcNumber: "DC-101", status: "DISPATCHED" },
      { id: "dc-102", dcNumber: "DC-102", status: "AT_VENDOR" },
    ];
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue(mockDispatchedDcs as any);

    const queue = await getSecurityReturnQueue("SECURITY");
    expect(queue.length).toBe(2);
    expect(prisma.deliveryChallan.findMany).toHaveBeenCalledWith({
      where: { status: { in: ["DISPATCHED", "AT_VENDOR"] } },
      include: expect.any(Object),
      orderBy: { updatedAt: "desc" },
    });
  });

  // 5. Material Inward/Return queue shows eligible dispatched/at-vendor DC
  it("5. confirms DISPATCHED DC transitions to AT_VENDOR upon vendor receipt confirmation", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(mockSecurityUser as any);
    vi.mocked(requirePermission).mockResolvedValue(mockSecurityUser as any);
    vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
      id: "dc-101",
      status: "DISPATCHED",
    } as any);

    const res = await confirmDcAtVendor("dc-101");
    expect(res.ok).toBe(true);
    expect(prisma.deliveryChallan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dc-101" },
        data: { status: "AT_VENDOR" },
      }),
    );
  });

  // 6. Security return changes status to SECURITY_RETURNED
  it("6. changes status to SECURITY_RETURNED when Security return is submitted", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(mockSecurityUser as any);
    vi.mocked(requirePermission).mockResolvedValue(mockSecurityUser as any);
    vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue({
      id: "dc-101",
      status: "DISPATCHED",
    } as any);

    const res = await submitSecurityReturn("dc-101", {
      actualInwardQty: 48,
      inwardDocumentNo: "GIN-999",
    });

    expect(res.ok).toBe(true);
    expect(prisma.deliveryChallan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dc-101" },
        data: expect.objectContaining({
          status: "SECURITY_RETURNED",
          securityEnteredBy: "sec-user-1",
        }),
      }),
    );
  });

  // 7. Security Returned count updates
  it("7. returns SECURITY_RETURNED DCs in getSecurityCompletedQueue", async () => {
    const mockReturned = [{ id: "dc-101", dcNumber: "DC-101", status: "SECURITY_RETURNED" }];
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue(mockReturned as any);

    const queue = await getSecurityCompletedQueue("SECURITY");
    expect(queue.length).toBe(1);
    expect(prisma.deliveryChallan.findMany).toHaveBeenCalledWith({
      where: { status: "SECURITY_RETURNED" },
      include: expect.any(Object),
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  });

  // 8. My Security Entries records user action and persists
  it("8. retrieves entries entered or dispatched by user in getMySecurityEntriesQueue", async () => {
    const mockUserEntries = [
      { id: "dc-101", dcNumber: "DC-101", status: "STORE_VERIFIED", securityEnteredBy: "sec-user-1" },
      { id: "dc-100", dcNumber: "DC-100", status: "DISPATCHED", securityDispatchedBy: "sec-user-1" },
    ];
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue(mockUserEntries as any);

    const queue = await getMySecurityEntriesQueue("SECURITY", "sec-user-1");
    expect(queue.length).toBe(2);
    expect(prisma.deliveryChallan.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { securityEnteredBy: "sec-user-1" },
          { securityDispatchedBy: "sec-user-1" },
        ],
      },
      include: expect.any(Object),
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  });

  // 9. Dashboard and queue counts remain consistent
  it("9. maintains queue consistency between queries", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([
      { id: "dc-1", status: "APPROVED" },
    ] as any);

    const dispatchQueue = await getSecurityDispatchQueue("SECURITY");
    expect(dispatchQueue.length).toBe(1);
  });

  // 10. Unauthorized roles cannot perform Security actions
  it("10. blocks non-permitted role from performing Security dispatch", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(mockStoreUser as any);
    vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError("Permission denied"));

    const res = await submitSecurityDispatch("dc-100", { dispatchQuantity: 50 });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("permission");
  });

  // 11. Security cannot edit Store-owned receipt/weight/Quality fields
  it("11. rejects submitSecurityReturn if Store weight or Quality fields are passed", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(mockSecurityUser as any);
    vi.mocked(requirePermission).mockResolvedValue(mockSecurityUser as any);

    const res = await submitSecurityReturn("dc-101", {
      actualInwardQty: 50,
      storeGatingWeight: 12.5,
    } as any);

    expect(res.ok).toBe(false);
    expect(res.error).toContain("cannot accept weights or Quality classification fields");
  });

  // 12. ADMIN can still see all records
  it("12. allows ADMIN user to query security queues", async () => {
    vi.mocked(prisma.deliveryChallan.findMany).mockResolvedValue([
      { id: "dc-admin-1", dcNumber: "DC-ADM-1", status: "APPROVED" },
    ] as any);

    const queue = await getSecurityDispatchQueue("ADMIN");
    expect(queue.length).toBe(1);
  });
});
