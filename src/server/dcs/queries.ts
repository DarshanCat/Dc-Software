import { prisma } from "@/lib/db";
import { filterDcDataForRole } from "./sanitizer";
import type { DeliveryChallan } from "@prisma/client";

/**
 * Authoritative DC Queue Queries for Role-Based Operations.
 * Ensures consistent filtering between Dashboards, Functional Pages, and Server Actions.
 */

// ==========================================================
// SECURITY QUEUES
// ==========================================================

export async function getSecurityDispatchQueue(roleKey: string = "SECURITY") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "APPROVED" },
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
    where: { status: "SECURITY_RETURNED" },
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

// ==========================================================
// MANAGEMENT QUEUES
// ==========================================================

export async function getManagementPendingApprovalQueue(roleKey: string = "MANAGEMENT") {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: "PENDING_APPROVAL" },
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
