"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { generateQrToken } from "@/services/dispatch.service";
import { Prisma, DcPurpose } from "@prisma/client";
import { stageResultBalance } from "@/analytics/math-engine";
import { notifyUsersWithPermission } from "@/server/notifications/service";

async function checkPermission(user: any, permission: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!user) return { ok: false, error: "Not signed in." };
  try {
    await requirePermission(user, permission);
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to perform this action." };
    return { ok: false, error: e instanceof Error ? e.message : "Permission denied." };
  }
}

// ---------------- 1. OUTWARD DC CREATION ----------------

export interface CreateOutwardDcInput {
  vendorId: string;
  department: string;
  woNumber: string;
  partNumber: string;
  partDescription?: string;
  pricing?: number;
  outwardWeight?: number;
  outwardGatingWeight?: number;
  outwardQtyRw?: number;
  returningFgQuantity?: number;
  length?: number;
  width?: number;
  height?: number;
  outwardBoringWeight?: number;
  remarks?: string;
  purpose?: DcPurpose;
}

export async function createOutwardDc(input: CreateOutwardDcInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_CREATE);
  if (!permCheck.ok) return permCheck;

  if (!input.vendorId) return { ok: false, error: "Supplier (Vendor) is mandatory." };
  if (!input.woNumber) return { ok: false, error: "Work Order (WO ID) is mandatory." };
  if (!input.department) return { ok: false, error: "Department is mandatory." };

  const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
  if (!vendor) return { ok: false, error: "Selected Supplier was not found." };
  if (!vendor.active) return { ok: false, error: "Selected Supplier is inactive." };

  const now = new Date();
  const fy = fiscalYearOf(now);

  const result = await prisma.$transaction(async (tx) => {
    const dcNumber = await nextNumber(tx, { key: "DC", fiscalYear: fy });
    const qrToken = generateQrToken();

    const dc = await tx.deliveryChallan.create({
      data: {
        dcNumber,
        dcDate: now,
        woNumber: input.woNumber.trim(),
        partNumber: input.partNumber ? input.partNumber.trim() : null,
        vendorId: input.vendorId,
        department: input.department.trim(),
        purpose: input.purpose || "JOB_WORK",

        // Master Snapshot
        supplierNameSnapshot: vendor.vendorName,
        supplierAddressSnapshot: vendor.address || `${vendor.city || ""}, ${vendor.state || ""}`,
        supplierGstSnapshot: vendor.gstNumber || null,
        partNumberSnapshot: input.partNumber ? input.partNumber.trim() : null,
        partDescriptionSnapshot: input.partDescription ? input.partDescription.trim() : null,
        pricingSnapshot: input.pricing ? new Prisma.Decimal(input.pricing) : null,

        // Outward Fields
        outwardDate: now,
        outwardWeight: input.outwardWeight ? new Prisma.Decimal(input.outwardWeight) : null,
        outwardGatingWeight: input.outwardGatingWeight ? new Prisma.Decimal(input.outwardGatingWeight) : null,
        outwardQtyRw: input.outwardQtyRw ? new Prisma.Decimal(input.outwardQtyRw) : null,
        returnFgQuantity: input.returningFgQuantity ? new Prisma.Decimal(input.returningFgQuantity) : null,
        length: input.length ? new Prisma.Decimal(input.length) : null,
        width: input.width ? new Prisma.Decimal(input.width) : null,
        height: input.height ? new Prisma.Decimal(input.height) : null,
        outwardBoringWeight: input.outwardBoringWeight ? new Prisma.Decimal(input.outwardBoringWeight) : null,
        remarks: input.remarks || null,

        status: "OUTWARD_CREATED",
        createdBy: user!.id,
        preparedByName: user!.email || "Factory User",
        qrToken,
      },
    });

    await tx.statusHistory.create({
      data: {
        dcId: dc.id,
        toStatus: "OUTWARD_CREATED",
        changedBy: user!.id,
        reason: "Outward DC Created",
      },
    });

    return dc;
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "OUTWARD_DC_CREATED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: result.id,
    reason: `Outward DC ${result.dcNumber} created for supplier ${vendor.vendorName}`,
  });

  revalidatePath("/dcs");
  return { ok: true, dcId: result.id, dcNumber: result.dcNumber };
}

// ---------------- 2. INWARD RECEIPT (SECURITY ROLE) ----------------

export interface RecordInwardReceiptInput {
  dcId: string;
  actualInwardQty: number;
  inwardDate?: string;
  inwardDocumentNo?: string;
  invoiceNumber?: string;
  inwardGatingWeight?: number;
  inwardBoringWeight?: number;
  remarks?: string;
}

export async function recordInwardReceipt(input: RecordInwardReceiptInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SECURITY_RETURN);
  if (!permCheck.ok) return permCheck;

  if (input.actualInwardQty <= 0) {
    return { ok: false, error: "Actual Inward Quantity must be greater than zero." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: input.dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  const now = new Date();
  const inwardDate = input.inwardDate ? new Date(input.inwardDate) : now;

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: input.dcId },
      data: {
        status: "INWARD_RECEIVED",
        actualInwardQty: new Prisma.Decimal(input.actualInwardQty),
        inwardDate,
        inwardDocumentNo: input.inwardDocumentNo || null,
        invoiceNumber: input.invoiceNumber || dc.invoiceNumber,
        inwardGatingWeight: input.inwardGatingWeight ? new Prisma.Decimal(input.inwardGatingWeight) : null,
        inwardBoringWeight: input.inwardBoringWeight ? new Prisma.Decimal(input.inwardBoringWeight) : null,
        securityReturnRemarks: input.remarks || null,
        securityEnteredBy: user!.id,
        securityEnteredAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId: input.dcId,
        fromStatus: dc.status,
        toStatus: "INWARD_RECEIVED",
        changedBy: user!.id,
        reason: `Physical Inward Receipt recorded (Actual Inward: ${input.actualInwardQty})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "INWARD_RECEIPT_RECORDED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: input.dcId,
    reason: `Security recorded Inward Qty ${input.actualInwardQty}`,
  });

  await notifyUsersWithPermission(
    prisma,
    PERMISSIONS.STORE_VERIFY,
    {
      type: "DC_STATUS",
      title: `Inward Received - DC ${dc.dcNumber}`,
      body: `Material received at gate. Store confirmation required for DC ${dc.dcNumber}.`,
      entityType: "DeliveryChallan",
      entityId: input.dcId,
      targetUrl: `/dcs/${input.dcId}`,
    }
  );

  revalidatePath(`/dcs/${input.dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ---------------- 3. STORE RECEIPT CONFIRMATION (STORE ROLE) ----------------

export interface ConfirmStoreReceiptInput {
  dcId: string;
  storeReceivedQty: number;
  storeReceivedDate?: string;
  storeRemarks?: string;
}

export async function confirmStoreReceipt(input: ConfirmStoreReceiptInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.STORE_VERIFY);
  if (!permCheck.ok) return permCheck;

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: input.dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  const actualInward = Number(dc.actualInwardQty ?? dc.securityFgQuantity ?? 0);
  if (input.storeReceivedQty <= 0) {
    return { ok: false, error: "Store Received Quantity must be greater than zero." };
  }

  if (input.storeReceivedQty > actualInward && actualInward > 0) {
    return { ok: false, error: `Store Received Qty (${input.storeReceivedQty}) cannot be greater than Actual Inward Qty (${actualInward}).` };
  }

  const now = new Date();
  const recDate = input.storeReceivedDate ? new Date(input.storeReceivedDate) : now;

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: input.dcId },
      data: {
        status: "QUALITY_PENDING",
        storeReceivedQty: new Prisma.Decimal(input.storeReceivedQty),
        storeReceivedDate: recDate,
        storeConfirmedBy: user!.id,
        storeRemarks: input.storeRemarks || null,
        storeVerifiedBy: user!.id,
        storeVerifiedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId: input.dcId,
        fromStatus: dc.status,
        toStatus: "QUALITY_PENDING",
        changedBy: user!.id,
        reason: `Store Receipt Confirmed (${input.storeReceivedQty}). Moved to QUALITY_PENDING.`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "STORE_RECEIPT_CONFIRMED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: input.dcId,
    reason: `Store confirmed quantity ${input.storeReceivedQty}`,
  });

  await notifyUsersWithPermission(
    prisma,
    PERMISSIONS.RECEIPT_EDIT,
    {
      type: "DC_STATUS",
      title: `Store Confirmed - DC ${dc.dcNumber}`,
      body: `Store confirmed ${input.storeReceivedQty} NOS for DC ${dc.dcNumber}. Quality inspection pending.`,
      entityType: "DeliveryChallan",
      entityId: input.dcId,
      targetUrl: `/dcs/${input.dcId}`,
    }
  );

  revalidatePath(`/dcs/${input.dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ---------------- 4. QUALITY INSPECTION (QUALITY ROLE) ----------------

export interface SubmitQualityInspectionInput {
  dcId: string;
  goodQty: number;
  rejectionQty: number;
  scrapQty: number;
  qualityDecision: "PASSED" | "PARTIAL_ACCEPTANCE" | "REJECTED" | "SCRAPPED";
  inspectionRemarks?: string;
}

export async function submitQualityInspection(input: SubmitQualityInspectionInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.RECEIPT_EDIT);
  if (!permCheck.ok) return permCheck;

  if (input.goodQty < 0 || input.rejectionQty < 0 || input.scrapQty < 0) {
    return { ok: false, error: "Quality quantities (Good, Rejection, Scrap) cannot be negative." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: input.dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  const actualInward = Number(dc.actualInwardQty ?? dc.storeReceivedQty ?? dc.securityFgQuantity ?? 0);

  // Mandatory Quantity Reconciliation Validation: Good + Rejection + Scrap == Actual Inward Qty
  const balanceCheck = stageResultBalance(input.goodQty, input.rejectionQty, input.scrapQty, actualInward);
  if (!balanceCheck.isValid) {
    return {
      ok: false,
      error: `Quality quantities do not match Actual Inward Qty. Good (${input.goodQty}) + Rejection (${input.rejectionQty}) + Scrap (${input.scrapQty}) = ${balanceCheck.total}, but Actual Inward Qty is ${actualInward}. Variance balance: ${balanceCheck.balance}.`,
    };
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: input.dcId },
      data: {
        status: "MANAGER_APPROVAL_PENDING",
        goodQty: new Prisma.Decimal(input.goodQty),
        rejectionQty: new Prisma.Decimal(input.rejectionQty),
        scrapQty: new Prisma.Decimal(input.scrapQty),
        qualityDecision: input.qualityDecision,
        inspectionDate: now,
        inspectedBy: user!.id,
        inspectionRemarks: input.inspectionRemarks || null,

        // Also sync legacy quality fields
        finalApprovedFgQuantity: new Prisma.Decimal(input.goodQty),
        finalApprovedRejectionQuantity: new Prisma.Decimal(input.rejectionQty),
        finalApprovedScrapQuantity: new Prisma.Decimal(input.scrapQty),
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId: input.dcId,
        fromStatus: dc.status,
        toStatus: "MANAGER_APPROVAL_PENDING",
        changedBy: user!.id,
        reason: `Quality Inspection Completed (Good: ${input.goodQty}, Reject: ${input.rejectionQty}, Scrap: ${input.scrapQty}). Decision: ${input.qualityDecision}`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "QUALITY_INSPECTION_SUBMITTED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: input.dcId,
    reason: `Quality Inspection submitted: Decision ${input.qualityDecision} (Good: ${input.goodQty})`,
  });

  await notifyUsersWithPermission(
    prisma,
    PERMISSIONS.MANAGER_FINAL_APPROVE,
    {
      type: "DC_STATUS",
      title: `Quality Completed - DC ${dc.dcNumber}`,
      body: `Quality inspection completed for DC ${dc.dcNumber}. Manager approval pending.`,
      entityType: "DeliveryChallan",
      entityId: input.dcId,
      targetUrl: `/dcs/${input.dcId}`,
    }
  );

  revalidatePath(`/dcs/${input.dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ---------------- 5. MANAGER APPROVAL (MANAGER ROLE) ----------------

export interface ReviewManagerApprovalInput {
  dcId: string;
  action: "APPROVE" | "REJECT" | "SEND_BACK" | "HOLD";
  approvalRemarks?: string;
}

export async function reviewManagerApproval(input: ReviewManagerApprovalInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.MANAGER_FINAL_APPROVE);
  if (!permCheck.ok) return permCheck;

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: input.dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  let nextStatus: string = "PAYMENT_APPROVED";
  if (input.action === "APPROVE") nextStatus = "PAYMENT_APPROVED";
  else if (input.action === "REJECT") nextStatus = "REJECTED";
  else if (input.action === "SEND_BACK") nextStatus = "SENT_BACK";
  else if (input.action === "HOLD") nextStatus = "HOLD";

  const now = new Date();

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: input.dcId },
      data: {
        status: nextStatus as any,
        approvalStatus: input.action,
        approvalRemarks: input.approvalRemarks || null,
        finalApprovedBy: user!.id,
        finalApprovedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId: input.dcId,
        fromStatus: dc.status,
        toStatus: nextStatus,
        changedBy: user!.id,
        reason: `Manager action: ${input.action}. Remarks: ${input.approvalRemarks || "None"}`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: `MANAGER_ACTION_${input.action}`,
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: input.dcId,
    reason: `Manager reviewed DC ${dc.dcNumber}: ${input.action}`,
  });

  revalidatePath(`/dcs/${input.dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}
