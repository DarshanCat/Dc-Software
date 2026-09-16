import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "@/config/permissions";
import { getNavigationForUser } from "@/config/navigation";
import { createVendor, updateVendor, toggleVendorActive, deleteVendor } from "@/server/vendors/actions";
import { createItemMaster, updateItemMaster, toggleItemMasterStatus, deleteItemMaster } from "@/server/masters/items";
import { createDepartment, updateDepartment, toggleDepartmentStatus, deleteDepartment } from "@/server/masters/departments";
import { createProcess, updateProcess, toggleProcessActive, deleteProcess } from "@/server/processes/actions";
import { createJobWorkStandard, updateJobWorkStandard, toggleJobWorkStandardStatus, deleteJobWorkStandard } from "@/server/masters/job-work-standards";
import { createUOM, updateUOM, deleteUOM } from "@/server/masters/uom";
import { createScrapType, updateScrapType, toggleScrapTypeStatus, deleteScrapType } from "@/server/masters/scrap-types";

vi.mock("@/server/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/server/authorize", () => ({
  hasPermission: vi.fn(),
  requirePermission: vi.fn(),
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
    vendor: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    itemMaster: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    process: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    jobWorkStandard: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    uOM: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    scrapType: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    deliveryChallan: {
      count: vi.fn(),
    },
    workOrder: {
      count: vi.fn(),
    },
    registrationRequest: {
      count: vi.fn(),
    },
    scrapReceiptItem: {
      count: vi.fn(),
    },
    materialClassificationItem: {
      count: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { prisma } from "@/lib/db";

describe("Role-Based Master Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Permissions Configuration & Navigation Matrix", () => {
    it("grants required master permissions to MANAGEMENT role", () => {
      const mgmtPerms = DEFAULT_ROLE_PERMISSIONS.MANAGEMENT;
      expect(mgmtPerms).toContain(PERMISSIONS.VENDOR_VIEW);
      expect(mgmtPerms).toContain(PERMISSIONS.VENDOR_CREATE);
      expect(mgmtPerms).toContain(PERMISSIONS.VENDOR_EDIT);
      expect(mgmtPerms).toContain(PERMISSIONS.ITEM_VIEW);
      expect(mgmtPerms).toContain(PERMISSIONS.ITEM_CREATE);
      expect(mgmtPerms).toContain(PERMISSIONS.ITEM_EDIT);
      expect(mgmtPerms).toContain(PERMISSIONS.DEPARTMENT_VIEW);
      expect(mgmtPerms).toContain(PERMISSIONS.DEPARTMENT_CREATE);
      expect(mgmtPerms).toContain(PERMISSIONS.DEPARTMENT_EDIT);
      expect(mgmtPerms).toContain(PERMISSIONS.PROCESS_VIEW);
      expect(mgmtPerms).toContain(PERMISSIONS.PROCESS_CREATE);
      expect(mgmtPerms).toContain(PERMISSIONS.PROCESS_EDIT);
      expect(mgmtPerms).toContain(PERMISSIONS.JOB_WORK_STANDARD_VIEW);
      expect(mgmtPerms).toContain(PERMISSIONS.JOB_WORK_STANDARD_CREATE);
      // Ensure no admin user manage / role manage permissions
      expect(mgmtPerms).not.toContain(PERMISSIONS.USER_MANAGE);
      expect(mgmtPerms).not.toContain(PERMISSIONS.ROLE_MANAGE);
    });

    it("grants required master permissions to STORES role", () => {
      const storePerms = DEFAULT_ROLE_PERMISSIONS.STORES;
      expect(storePerms).toContain(PERMISSIONS.VENDOR_VIEW);
      expect(storePerms).toContain(PERMISSIONS.VENDOR_CREATE);
      expect(storePerms).toContain(PERMISSIONS.VENDOR_EDIT);
      expect(storePerms).toContain(PERMISSIONS.ITEM_VIEW);
      expect(storePerms).toContain(PERMISSIONS.ITEM_CREATE);
      expect(storePerms).toContain(PERMISSIONS.ITEM_EDIT);
      expect(storePerms).toContain(PERMISSIONS.UOM_VIEW);
      expect(storePerms).toContain(PERMISSIONS.UOM_CREATE);
      expect(storePerms).toContain(PERMISSIONS.UOM_EDIT);
      expect(storePerms).toContain(PERMISSIONS.SCRAP_VIEW);
      expect(storePerms).toContain(PERMISSIONS.SCRAP_EDIT);
      // Ensure no admin user manage / role manage permissions
      expect(storePerms).not.toContain(PERMISSIONS.USER_MANAGE);
      expect(storePerms).not.toContain(PERMISSIONS.ROLE_MANAGE);
    });

    it("renders Masters navigation section for MANAGEMENT users", () => {
      const nav = getNavigationForUser(["MANAGEMENT"]);
      const mastersSection = nav.find((s) => s.label === "MASTERS");
      expect(mastersSection).toBeDefined();
      const labels = mastersSection!.items.map((i) => i.label);
      expect(labels).toContain("Supplier Master");
      expect(labels).toContain("Part / Item Master");
      expect(labels).toContain("Department Master");
      expect(labels).toContain("Pricing Master");
      expect(labels).toContain("Processes");
      expect(labels).toContain("Job Work Standards");
    });

    it("renders Masters navigation section for STORES users", () => {
      const nav = getNavigationForUser(["STORES"]);
      const mastersSection = nav.find((s) => s.label === "MASTERS");
      expect(mastersSection).toBeDefined();
      const labels = mastersSection!.items.map((i) => i.label);
      expect(labels).toContain("Supplier Master");
      expect(labels).toContain("Part / Item Master");
      expect(labels).toContain("UOM");
      expect(labels).toContain("Scrap Types");
    });
  });

  describe("Safe Deletion Dependencies", () => {
    it("blocks vendor deletion if referenced in Delivery Challan records", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: "user-1", email: "mgr@test.com", roleKeys: ["MANAGEMENT"] } as any);
      vi.mocked(requirePermission).mockResolvedValue(undefined);
      vi.mocked(prisma.vendor.findUnique).mockResolvedValue({ id: "v-1", vendorCode: "V1", vendorName: "Vendor One" } as any);
      vi.mocked(prisma.deliveryChallan.count).mockResolvedValue(3);
      vi.mocked(prisma.workOrder.count).mockResolvedValue(0);

      const res = await deleteVendor("v-1");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("cannot be deleted");
      }
    });

    it("blocks item deletion if referenced in Delivery Challan records", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: "user-2", email: "store@test.com", roleKeys: ["STORES"] } as any);
      vi.mocked(requirePermission).mockResolvedValue(undefined);
      vi.mocked(prisma.itemMaster.findUnique).mockResolvedValue({ id: "i-1", partNumber: "PN-999" } as any);
      vi.mocked(prisma.deliveryChallan.count).mockResolvedValue(2);
      vi.mocked(prisma.jobWorkStandard.count).mockResolvedValue(0);

      const res = await deleteItemMaster("i-1");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("cannot be deleted");
      }
    });

    it("blocks department deletion if referenced in Delivery Challans or Registration Requests", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: "user-1", email: "mgr@test.com", roleKeys: ["MANAGEMENT"] } as any);
      vi.mocked(requirePermission).mockResolvedValue(undefined);
      vi.mocked(prisma.department.findUnique).mockResolvedValue({ id: "d-1", code: "PROD", name: "PRODUCTION" } as any);
      vi.mocked(prisma.deliveryChallan.count).mockResolvedValue(5);
      vi.mocked(prisma.registrationRequest.count).mockResolvedValue(0);

      const res = await deleteDepartment("d-1");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("cannot be deleted");
      }
    });

    it("allows deleting unreferenced items", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: "user-2", email: "store@test.com", roleKeys: ["STORES"] } as any);
      vi.mocked(requirePermission).mockResolvedValue(undefined);
      vi.mocked(prisma.itemMaster.findUnique).mockResolvedValue({ id: "i-2", partNumber: "PN-UNUSED", partDescription: "Unused" } as any);
      vi.mocked(prisma.deliveryChallan.count).mockResolvedValue(0);
      vi.mocked(prisma.jobWorkStandard.count).mockResolvedValue(0);
      vi.mocked(prisma.itemMaster.delete).mockResolvedValue({ id: "i-2" } as any);

      const res = await deleteItemMaster("i-2");
      expect(res.ok).toBe(true);
      expect(prisma.itemMaster.delete).toHaveBeenCalledWith({ where: { id: "i-2" } });
    });
  });

  describe("Server-Side Permission Controls", () => {
    it("blocks unauthorized user (e.g. SECURITY role) from creating vendor", async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: "user-sec", email: "sec@test.com", roleKeys: ["SECURITY"] } as any);
      vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError("Permission denied"));

      const res = await createVendor({ vendorCode: "V-NEW", vendorName: "Test Vendor" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("permission");
      }
    });
  });
});
