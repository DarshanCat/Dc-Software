import { prisma } from "@/lib/db";
import { filterDcDataForRole } from "./sanitizer";
import { buildDcDateRange } from "@/lib/dc-date";
import type { DeliveryChallan, Prisma, DcStatus, DcMaterialType } from "@prisma/client";

/**
 * Authoritative DC Queue Queries for Role-Based Operations.
 * Ensures consistent filtering between Dashboards, Functional Pages, and Server Actions.
 */

// ==========================================================
// SECURITY QUEUES
// ==========================================================

export async function getSecurityDispatchQueue(roleKey: string = "SECURITY") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: {
      OR: [
        { status: "APPROVED" },
        { status: "DRAFT", movementType: { in: ["TOOL", "COMPANY_PROPERTY"] } },
      ],
    },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

/**
 * CANONICAL SECURITY RETURN QUEUE (Single Source of Truth)
 * Shared between Security Dashboard and /security/material-inward page.
 * Returns DCs that have been dispatched and are awaiting gate material return entry.
 */
export async function getSecurityReturnQueue(roleKey: string = "SECURITY") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { in: ["DISPATCHED", "AT_VENDOR"] } },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export async function getSecurityCompletedQueue(roleKey: string = "SECURITY") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "SECURITY_RETURNED" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export async function getMySecurityEntriesQueue(roleKey: string = "SECURITY", userId?: string) {
  const whereCondition: Prisma.DeliveryChallanWhereInput = userId
    ? {
        OR: [
          { securityEnteredBy: userId },
          { securityDispatchedBy: userId },
        ],
      }
    : {
        OR: [
          { securityEnteredBy: { not: null } },
          { securityDispatchedBy: { not: null } },
          { status: "SECURITY_RETURNED" as DcStatus },
        ],
      };

  const dcs = await prisma.deliveryChallan.findMany({
    where: whereCondition,
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

// ==========================================================
// STORE QUEUES
// ==========================================================

export async function getStoreDraftQueue(roleKey: string = "STORES") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "DRAFT" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export async function getStorePendingApprovalQueue(roleKey: string = "STORES") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export async function getStoreVerificationQueue(roleKey: string = "STORES") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "SECURITY_RETURNED", movementType: "MATERIAL" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export async function getStoreCompletedQueue(roleKey: string = "STORES") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "STORE_VERIFIED" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export interface StoresAllDcsFilters {
  dcDateFrom?: string | null;
  dcDateTo?: string | null;
  materialType?: string | null;
  status?: string | null;
  search?: string | null;
}

export interface StoresAllDcsResult {
  dcs: Array<ReturnType<typeof filterDcDataForRole> & { createdByName: string }>;
  error?: string;
}

/**
 * Every Delivery Challan visible to Stores, across the full lifecycle (DRAFT
 * through CLOSED) and regardless of who created it - Stores must be able to
 * track every DC in the system, not only the ones they personally created.
 * `createdBy` is resolved to a display name so creator attribution is never
 * lost even though visibility is no longer scoped to it. This does not grant
 * any mutation right, only visibility; DC-stage write permissions (DC_CREATE,
 * STORE_VERIFY, ...) are unchanged and enforced by their own server actions.
 *
 * Date filtering uses the authoritative DeliveryChallan.dcDate with the same
 * inclusive IST business-day boundaries as Manager's date search
 * (buildDcDateRange) - an invalid range (or From > To) must return no rows
 * rather than silently showing an unfiltered list.
 */
export async function getAllDcsForStores(
  filters: StoresAllDcsFilters = {},
  roleKey: string = "STORES",
): Promise<StoresAllDcsResult> {
  const dateRange = buildDcDateRange(filters.dcDateFrom, filters.dcDateTo);

  const where: Prisma.DeliveryChallanWhereInput = {};

  if (dateRange.error) {
    // Fail closed: never show an unfiltered list when the range itself is invalid.
    where.dcDate = { gte: new Date(8640000000000000) };
  } else if (dateRange.where) {
    where.dcDate = dateRange.where;
  }

  if (filters.materialType === "PRODUCTION" || filters.materialType === "CONVERSION") {
    where.materialType = filters.materialType as DcMaterialType;
  }

  if (filters.status) {
    where.status = filters.status as DcStatus;
  }

  const search = (filters.search ?? "").trim();
  if (search) {
    where.OR = [
      { dcNumber: { contains: search, mode: "insensitive" } },
      { woNumber: { contains: search, mode: "insensitive" } },
      { partNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const dcs = await prisma.deliveryChallan.findMany({
    where,
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { dcDate: "desc" },
    take: 200,
  });

  const creatorIds = [...new Set(dcs.map((dc) => dc.createdBy).filter((v): v is string => !!v))];
  const creators = creatorIds.length
    ? await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const creatorMap = new Map(creators.map((u) => [u.id, u.name || u.email]));

  return {
    dcs: dcs.map((dc) => ({
      ...filterDcDataForRole(dc, roleKey),
      createdByName: dc.createdBy ? creatorMap.get(dc.createdBy) || dc.createdBy : "—",
    })),
    error: dateRange.error,
  };
}

// ==========================================================
// CUSTODIAN QUEUE (Other DCs: Tool / Asset)
// ==========================================================

export async function getCustodianVerificationQueue(roleKey: string = "STORES") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "SECURITY_RETURNED", movementType: { in: ["TOOL", "COMPANY_PROPERTY"] } },
    include: { vendor: { select: { vendorName: true } }, items: true },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

// ==========================================================
// MANAGEMENT QUEUES
// ==========================================================

export async function getManagementPendingApprovalQueue(roleKey: string = "MANAGEMENT") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "PENDING_APPROVAL", movementType: "MATERIAL" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export async function getManagementFinalApprovalQueue(roleKey: string = "MANAGEMENT") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "STORE_VERIFIED" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export async function getManagementPaymentApprovalQueue(roleKey: string = "MANAGEMENT") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { in: ["QUALITY_COMPLETED", "MANAGER_APPROVAL_PENDING", "FINAL_APPROVED"] } },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

// ==========================================================
// ACCOUNTS QUEUES
// ==========================================================

export async function getAccountsPaymentQueue(roleKey: string = "ACCOUNTS") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "APPROVED_FOR_PAYMENT" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}

export async function getAccountsClosedQueue(roleKey: string = "ACCOUNTS") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "CLOSED" },
    include: { vendor: { select: { vendorName: true } }, process: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return dcs.map((dc) => filterDcDataForRole(dc, roleKey));
}
