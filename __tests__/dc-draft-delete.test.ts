import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteDraftDc } from "@/server/dcs/extended-actions";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";

vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryChallan: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    statusHistory: {
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

vi.mock("@/server/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/server/authorize", () => ({
  hasPermission: vi.fn(),
  requirePermission: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
  UnauthenticatedError: class UnauthenticatedError extends Error {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("DC Delete Rule — Draft Only & Authorization Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow Creator to delete a DRAFT status DC with no operational records", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: "creator-user-123",
      email: "creator@example.com",
      roleKeys: ["STORES"],
    } as any);

    vi.mocked(hasPermission).mockResolvedValue(true);

    const mockDc = {
      id: "dc-draft-001",
      dcNumber: "DC-2026-00001",
      status: "DRAFT",
      createdBy: "creator-user-123",
      dispatch: null,
      receipts: [],
      scrapReceipts: [],
      reconciliation: null,
      exceptions: [],
      recoveryRequirements: [],
      recoveryReceipts: [],
      classifications: [],
      statusHistory: [{ id: "sh-1", toStatus: "DRAFT" }],
    };

    vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDc as any);
    vi.mocked(prisma.statusHistory.deleteMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.deliveryChallan.delete).mockResolvedValue(mockDc as any);

    const res = await deleteDraftDc("dc-draft-001");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.dcId).toBe("dc-draft-001");
      expect(res.dcNumber).toBe("DC-2026-00001");
    }
    expect(prisma.deliveryChallan.delete).toHaveBeenCalledWith({
      where: { id: "dc-draft-001" },
    });
  });

  const nonDraftStatuses = [
    "PENDING_APPROVAL",
    "APPROVED",
    "DISPATCHED",
    "MATERIAL_OUT",
    "SECURITY_RETURNED",
    "INWARD_RECEIVED",
    "STORE_VERIFIED",
    "STORE_CONFIRMED",
    "QUALITY_COMPLETED",
    "APPROVED_FOR_PAYMENT",
    "CLOSED",
    "REJECTED",
  ];

  nonDraftStatuses.forEach((status) => {
    it(`should REJECT deletion for non-draft status: ${status}`, async () => {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "creator-user-123",
        email: "creator@example.com",
        roleKeys: ["ADMIN"],
      } as any);

      vi.mocked(hasPermission).mockResolvedValue(true);

      const mockDc = {
        id: `dc-${status.toLowerCase()}`,
        dcNumber: `DC-2026-${status}`,
        status,
        createdBy: "creator-user-123",
        dispatch: null,
        receipts: [],
        scrapReceipts: [],
        reconciliation: null,
        exceptions: [],
        recoveryRequirements: [],
        recoveryReceipts: [],
        classifications: [],
        statusHistory: [],
      };

      vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDc as any);

      const res = await deleteDraftDc(mockDc.id);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Only Draft DCs can be deleted.");
      }
      expect(prisma.deliveryChallan.delete).not.toHaveBeenCalled();
    });
  });

  it("should REJECT deletion if user is not creator and not authorized Admin", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: "other-user-999",
      email: "security@example.com",
      roleKeys: ["SECURITY"],
    } as any);

    vi.mocked(hasPermission).mockResolvedValue(false);

    const mockDc = {
      id: "dc-draft-002",
      dcNumber: "DC-2026-00002",
      status: "DRAFT",
      createdBy: "creator-user-123", // Created by someone else!
      dispatch: null,
      receipts: [],
      scrapReceipts: [],
      reconciliation: null,
      exceptions: [],
      recoveryRequirements: [],
      recoveryReceipts: [],
      classifications: [],
      statusHistory: [],
    };

    vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDc as any);

    const res = await deleteDraftDc("dc-draft-002");

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("You are not authorized to delete this Draft DC.");
    }
    expect(prisma.deliveryChallan.delete).not.toHaveBeenCalled();
  });

  it("should REJECT deletion if Draft DC has existing operational records", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: "creator-user-123",
      email: "creator@example.com",
      roleKeys: ["STORES"],
    } as any);

    vi.mocked(hasPermission).mockResolvedValue(true);

    const mockDc = {
      id: "dc-draft-003",
      dcNumber: "DC-2026-00003",
      status: "DRAFT",
      createdBy: "creator-user-123",
      dispatch: { id: "dispatch-1" }, // Operational dispatch record exists!
      receipts: [],
      scrapReceipts: [],
      reconciliation: null,
      exceptions: [],
      recoveryRequirements: [],
      recoveryReceipts: [],
      classifications: [],
      statusHistory: [],
    };

    vi.mocked(prisma.deliveryChallan.findUnique).mockResolvedValue(mockDc as any);

    const res = await deleteDraftDc("dc-draft-003");

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Cannot delete DC with existing operational history.");
    }
    expect(prisma.deliveryChallan.delete).not.toHaveBeenCalled();
  });
});
