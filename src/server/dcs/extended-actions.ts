"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, hasPermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { generateQrToken } from "@/services/dispatch.service";
import { Prisma, DcPurpose, DcStatus } from "@prisma/client";
import { stageResultBalance } from "@/analytics/math-engine";
import { notifyUsersWithPermission } from "@/server/notifications/service";
import { closeDc } from "./actions";

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

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore revalidation errors during dynamic dev manifest invalidation
  }
}

// ---------------- 1. OUTWARD DC CREATION ----------------

export interface CreateOutwardDcInput {
  movementType?: "MATERIAL" | "TOOL" | "COMPANY_PROPERTY";
  isCommercialService?: boolean;
  destinationDepartment?: string;
  responsibleCustodian?: string;
  vendorId: string;
  department: string;
  woNumber?: string;
  partNumber?: string;
  partDescription?: string;
  pricingBasis?: "RW" | "FG";
  ratePerQuantity?: number;
  outwardWeight?: number;
  outwardGatingWeight?: number;
  outwardQtyRw?: number;
  returningFgQuantity?: number;
  rmUom?: string;
  fgUom?: string;
  dimensionUom?: string;
  length?: number;
  width?: number;
  height?: number;
  outwardBoringWeight?: number;
  remarks?: string;
  purpose?: DcPurpose;
  submitForApproval?: boolean;
}

export async function createOutwardDc(input: CreateOutwardDcInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_CREATE);
  if (!permCheck.ok) return permCheck;

  if (!input.vendorId) return { ok: false, error: "Supplier (Vendor) is mandatory." };

  const movementType = input.movementType || "MATERIAL";
  if (movementType === "MATERIAL") {
    if (!input.woNumber) return { ok: false, error: "Work Order (WO ID) is mandatory for Material DCs." };
    if (!input.department) return { ok: false, error: "Department is mandatory." };
    if (!input.pricingBasis) {
      return { ok: false, error: "Please select a pricing basis: RW Quantity or Returning FG Quantity." };
    }
    const rate = input.ratePerQuantity ?? 0;
    if (rate <= 0) {
      return { ok: false, error: "Rate Per Quantity must be greater than zero." };
    }
  }

  const rate = input.ratePerQuantity ?? 0;
  let pricingQty = 0;
  if (input.pricingBasis === "RW") {
    pricingQty = input.outwardQtyRw || 0;
  } else if (input.pricingBasis === "FG") {
    pricingQty = input.returningFgQuantity || 0;
  }

  const expectedAmount = Number((rate * pricingQty).toFixed(2));
  const initialStatus: DcStatus = input.submitForApproval ? "PENDING_APPROVAL" : "DRAFT";
  const initialReason = input.submitForApproval
    ? "DC Created and Submitted for Manager Approval"
    : "DC Created as Draft";

  const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
  if (!vendor) return { ok: false, error: "Selected Supplier was not found." };
  if (!vendor.active) return { ok: false, error: "Selected Supplier is inactive and cannot be used for a new DC." };

  const partNum = input.partNumber ? input.partNumber.trim() : "";
  let partDescriptionSnapshot: string | null = input.partDescription ? input.partDescription.trim() : null;

  if (partNum) {
    const itemMaster = await prisma.itemMaster.findFirst({ where: { partNumber: partNum } });
    if (itemMaster) {
      if (!itemMaster.active) {
        return { ok: false, error: "Selected Part is inactive and cannot be used for a new DC." };
      }
      partDescriptionSnapshot = itemMaster.partDescription;
    }
  }

  const now = new Date();
  const fy = fiscalYearOf(now);

  const result = await prisma.$transaction(async (tx) => {
    const dcNumber = await nextNumber(tx, { key: "DC", fiscalYear: fy });
    const qrToken = generateQrToken();

    const dc = await tx.deliveryChallan.create({
      data: {
        dcNumber,
        dcDate: now,
        movementType,
        isCommercialService: input.isCommercialService || false,
        destinationDepartment: input.destinationDepartment || null,
        responsibleCustodian: input.responsibleCustodian || null,
        woNumber: input.woNumber ? input.woNumber.trim() : "N/A",
        partNumber: partNum || null,
        rmQuantity: input.outwardQtyRw ? new Prisma.Decimal(input.outwardQtyRw) : null,
        returnFgQuantity: input.returningFgQuantity ? new Prisma.Decimal(input.returningFgQuantity) : null,
        vendorId: input.vendorId,
        department: input.department ? input.department.trim() : null,
        purpose: input.purpose || "JOB_WORK",

        // Master Snapshot (Authoritative)
        supplierNameSnapshot: vendor.vendorName,
        supplierAddressSnapshot: vendor.address || `${vendor.city || ""}, ${vendor.state || ""}`,
        supplierGstSnapshot: vendor.gstNumber || null,
        partNumberSnapshot: partNum || null,
        partDescriptionSnapshot: partDescriptionSnapshot,
        pricingSnapshot: new Prisma.Decimal(expectedAmount),

        // Commercial & Pricing Snapshot
        pricingBasis: input.pricingBasis,
        ratePerQuantity: new Prisma.Decimal(rate),
        pricingQuantitySnapshot: new Prisma.Decimal(pricingQty),
        expectedAmount: new Prisma.Decimal(expectedAmount),

        // Outward Fields
        outwardDate: now,
        outwardWeight: input.outwardWeight ? new Prisma.Decimal(input.outwardWeight) : null,
        outwardGatingWeight: input.outwardGatingWeight ? new Prisma.Decimal(input.outwardGatingWeight) : null,
        outwardQtyRw: input.outwardQtyRw ? new Prisma.Decimal(input.outwardQtyRw) : null,
        rmUom: input.rmUom || "NOS",
        fgUom: input.fgUom || "NOS",
        dimensionUom: input.dimensionUom || "mm",
        length: input.length ? new Prisma.Decimal(input.length) : null,
        width: input.width ? new Prisma.Decimal(input.width) : null,
        height: input.height ? new Prisma.Decimal(input.height) : null,
        outwardBoringWeight: input.outwardBoringWeight ? new Prisma.Decimal(input.outwardBoringWeight) : null,
        remarks: input.remarks || null,

        status: initialStatus,
        createdBy: user!.id,
        preparedByName: user!.email || "Factory User",
        qrToken,
      },
    });

    await tx.statusHistory.create({
      data: {
        dcId: dc.id,
        toStatus: initialStatus,
        changedBy: user!.id,
        reason: initialReason,
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

  safeRevalidatePath("/dcs");
  return { ok: true, dcId: result.id, dcNumber: result.dcNumber };
}

export interface UpdateOutwardDcInput extends CreateOutwardDcInput {
  dcId: string;
}

export async function updateOutwardDc(input: UpdateOutwardDcInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_CREATE);
  if (!permCheck.ok) return permCheck;

  if (!input.dcId) return { ok: false, error: "DC ID is required for update." };
  if (!input.vendorId) return { ok: false, error: "Supplier (Vendor) is mandatory." };
  if (!input.woNumber) return { ok: false, error: "Work Order (WO ID) is mandatory." };
  if (!input.department) return { ok: false, error: "Department is mandatory." };

  const existingDc = await prisma.deliveryChallan.findUnique({ where: { id: input.dcId } });
  if (!existingDc) return { ok: false, error: "Delivery Challan not found." };

  if (existingDc.status !== "DRAFT" && existingDc.status !== "SENT_BACK") {
    return { ok: false, error: `Delivery Challan cannot be edited in current status (${existingDc.status}).` };
  }

  if (!input.pricingBasis) {
    return { ok: false, error: "Please select a pricing basis: RW Quantity or Returning FG Quantity." };
  }
  const rate = input.ratePerQuantity ?? 0;
  if (rate <= 0) {
    return { ok: false, error: "Rate Per Quantity must be greater than zero." };
  }

  let pricingQty = 0;
  if (input.pricingBasis === "RW") {
    if (!input.outwardQtyRw || input.outwardQtyRw <= 0) {
      return { ok: false, error: "Outward Qty RW must be greater than zero when Price Based On is RW Quantity." };
    }
    pricingQty = input.outwardQtyRw;
  } else if (input.pricingBasis === "FG") {
    if (!input.returningFgQuantity || input.returningFgQuantity <= 0) {
      return { ok: false, error: "Returning FG Qty must be greater than zero when Price Based On is Returning FG Quantity." };
    }
    pricingQty = input.returningFgQuantity;
  } else {
    return { ok: false, error: "Invalid pricing basis selected." };
  }

  const expectedAmount = Number((rate * pricingQty).toFixed(2));
  const newStatus: DcStatus = input.submitForApproval ? "PENDING_APPROVAL" : "DRAFT";
  const updateReason = input.submitForApproval
    ? "DC Updated and Submitted for Manager Approval"
    : "DC Edits Saved";

  const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
  if (!vendor) return { ok: false, error: "Selected Supplier was not found." };
  if (!vendor.active) return { ok: false, error: "Selected Supplier is inactive." };

  const partNum = input.partNumber ? input.partNumber.trim() : "";
  let partDescriptionSnapshot: string | null = input.partDescription ? input.partDescription.trim() : null;

  if (partNum) {
    const itemMaster = await prisma.itemMaster.findFirst({ where: { partNumber: partNum } });
    if (itemMaster) {
      if (!itemMaster.active) {
        return { ok: false, error: "Selected Part is inactive." };
      }
      partDescriptionSnapshot = itemMaster.partDescription;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const dc = await tx.deliveryChallan.update({
      where: { id: input.dcId },
      data: {
        woNumber: input.woNumber ? input.woNumber.trim() : "N/A",
        partNumber: partNum || null,
        rmQuantity: input.outwardQtyRw ? new Prisma.Decimal(input.outwardQtyRw) : null,
        returnFgQuantity: input.returningFgQuantity ? new Prisma.Decimal(input.returningFgQuantity) : null,
        vendorId: input.vendorId,
        department: input.department.trim(),
        purpose: input.purpose || "JOB_WORK",

        // Master Snapshots
        supplierNameSnapshot: vendor.vendorName,
        supplierAddressSnapshot: vendor.address || `${vendor.city || ""}, ${vendor.state || ""}`,
        supplierGstSnapshot: vendor.gstNumber || null,
        partNumberSnapshot: partNum || null,
        partDescriptionSnapshot: partDescriptionSnapshot,
        pricingSnapshot: new Prisma.Decimal(expectedAmount),

        // Commercial & Pricing Snapshot
        pricingBasis: input.pricingBasis,
        ratePerQuantity: new Prisma.Decimal(rate),
        pricingQuantitySnapshot: new Prisma.Decimal(pricingQty),
        expectedAmount: new Prisma.Decimal(expectedAmount),

        // Outward Fields
        outwardWeight: input.outwardWeight ? new Prisma.Decimal(input.outwardWeight) : null,
        outwardGatingWeight: input.outwardGatingWeight ? new Prisma.Decimal(input.outwardGatingWeight) : null,
        outwardQtyRw: input.outwardQtyRw ? new Prisma.Decimal(input.outwardQtyRw) : null,
        length: input.length ? new Prisma.Decimal(input.length) : null,
        width: input.width ? new Prisma.Decimal(input.width) : null,
        height: input.height ? new Prisma.Decimal(input.height) : null,
        outwardBoringWeight: input.outwardBoringWeight ? new Prisma.Decimal(input.outwardBoringWeight) : null,
        remarks: input.remarks || null,

        status: newStatus,
      },
    });

    await tx.statusHistory.create({
      data: {
        dcId: dc.id,
        fromStatus: existingDc.status,
        toStatus: newStatus,
        changedBy: user!.id,
        reason: updateReason,
      },
    });

    return dc;
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "OUTWARD_DC_UPDATED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: result.id,
    reason: `Outward DC ${result.dcNumber} updated`,
  });

  safeRevalidatePath("/dcs");
  safeRevalidatePath(`/dcs/${result.id}`);
  return { ok: true, dcId: result.id, dcNumber: result.dcNumber };
}

// ---------------- 1B. DRAFT DC DELETION (DRAFT ONLY) ----------------

export async function deleteDraftDc(dcId: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!dcId) return { ok: false, error: "DC ID is required." };

  const dc = await prisma.deliveryChallan.findUnique({
    where: { id: dcId },
    include: {
      dispatch: true,
      receipts: true,
      scrapReceipts: true,
      reconciliation: true,
      exceptions: true,
      recoveryRequirements: true,
      recoveryReceipts: true,
      classifications: true,
      statusHistory: true,
    },
  });

  if (!dc) return { ok: false, error: "Delivery Challan not found." };

  // Rule: ONLY DRAFT DCs can be deleted!
  if (dc.status !== "DRAFT") {
    return { ok: false, error: "Only Draft DCs can be deleted." };
  }

  // Authorization Check: Only creator or Admin/DC_CREATE user can delete their Draft DC
  const isCreator = dc.createdBy === user.id;
  const isAdmin = user.roleKeys?.includes("ADMIN");
  const hasCreatePerm = await hasPermission(user.id, PERMISSIONS.DC_CREATE);

  if (!isCreator && !isAdmin && !hasCreatePerm) {
    return { ok: false, error: "You are not authorized to delete this Draft DC." };
  }

  // Verify operational child record safety (Rule 9: No Cascade Damage)
  const hasOperationalRecords =
    dc.dispatch !== null ||
    dc.receipts.length > 0 ||
    dc.scrapReceipts.length > 0 ||
    dc.reconciliation !== null ||
    dc.exceptions.length > 0 ||
    dc.recoveryRequirements.length > 0 ||
    dc.recoveryReceipts.length > 0 ||
    dc.classifications.length > 0;

  if (hasOperationalRecords) {
    return { ok: false, error: "Cannot delete DC with existing operational history." };
  }

  // Also check status history: if there are transitions beyond DRAFT/SENT_BACK, prevent deletion
  const operationalHistory = dc.statusHistory.filter(
    (sh) => sh.toStatus !== "DRAFT" && sh.toStatus !== "SENT_BACK"
  );
  if (operationalHistory.length > 0) {
    return { ok: false, error: "Cannot delete DC with existing operational history." };
  }

  // Transaction: Delete initial statusHistory, then DeliveryChallan
  await prisma.$transaction(async (tx) => {
    await tx.statusHistory.deleteMany({
      where: { dcId: dc.id },
    });
    await tx.deliveryChallan.delete({
      where: { id: dc.id },
    });
  });

  // Audit Logging (Rule 14: Audit)
  await writeAudit(prisma, {
    userId: user.id,
    action: "DRAFT_DELETED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dc.id,
    reason: `Draft DC ${dc.dcNumber} deleted by ${user.email || user.id} (Role: ${user.roleKeys?.[0] || "USER"})`,
  });

  safeRevalidatePath("/dcs");
  safeRevalidatePath(`/dcs/${dc.id}`);
  return { ok: true, dcId: dc.id, dcNumber: dc.dcNumber };
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
        securityFgQuantity: new Prisma.Decimal(input.actualInwardQty),
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
    action: "SECURITY_INWARD_RECORDED",
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
  storeGatingWeight?: number;
  storeBoringWeight?: number;
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
        status: "STORE_VERIFIED",
        storeReceivedQty: new Prisma.Decimal(input.storeReceivedQty),
        storeVerifiedFgQuantity: new Prisma.Decimal(input.storeReceivedQty),
        storeReceivedDate: recDate,
        storeGatingWeight: input.storeGatingWeight !== undefined ? new Prisma.Decimal(input.storeGatingWeight) : undefined,
        storeBoringWeight: input.storeBoringWeight !== undefined ? new Prisma.Decimal(input.storeBoringWeight) : undefined,
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
        toStatus: "STORE_VERIFIED",
        changedBy: user!.id,
        reason: `Store Receipt Confirmed (${input.storeReceivedQty}). Moved to STORE_VERIFIED.`,
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

// ---------------- 4. QUALITY INSPECTION (QUALITY ROLE ONLY) ----------------

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

  // Strict Backend Role Check: SECURITY and STORE roles are strictly prohibited from creating/editing Quality quantities
  const roleKeys = user?.roleKeys || [];
  const isQualityAuthorized = roleKeys.some((r: string) => ["QUALITY", "ADMIN"].includes(r));
  if (!isQualityAuthorized) {
    return {
      ok: false,
      error: "403 Forbidden: Security and Store roles are strictly prohibited from entering or submitting Quality Inspection quantities.",
    };
  }

  if (input.goodQty < 0 || input.rejectionQty < 0 || input.scrapQty < 0) {
    return { ok: false, error: "Quality quantities (Good, Rejection, Scrap) cannot be negative." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: input.dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "STORE_VERIFIED" && dc.status !== "QUALITY_PENDING") {
    return { ok: false, error: `DC must be in STORE_VERIFIED status for Quality Inspection. Current: ${dc.status}` };
  }

  const storeReceived = dc.storeReceivedQty !== null ? Number(dc.storeReceivedQty) : null;
  const actualInward = dc.actualInwardQty !== null ? Number(dc.actualInwardQty) : (dc.securityFgQuantity !== null ? Number(dc.securityFgQuantity) : 0);
  const targetQty = storeReceived !== null ? storeReceived : actualInward;

  // Mandatory Quantity Reconciliation Validation: Good + Rejection + Scrap == Store Received Qty
  const sum = input.goodQty + input.rejectionQty + input.scrapQty;
  if (sum !== targetQty) {
    return {
      ok: false,
      error: "Good + Rejection + Scrap must equal the Store Received Qty.",
    };
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: input.dcId },
      data: {
        status: "QUALITY_COMPLETED",
        goodQty: new Prisma.Decimal(input.goodQty),
        rejectionQty: new Prisma.Decimal(input.rejectionQty),
        scrapQty: new Prisma.Decimal(input.scrapQty),
        qualityDecision: input.qualityDecision,
        inspectionDate: now,
        inspectedBy: user!.id,
        inspectionRemarks: input.inspectionRemarks || null,

        // Sync legacy quality fields
        finalApprovedFgQuantity: new Prisma.Decimal(input.goodQty),
        finalApprovedRejectionQuantity: new Prisma.Decimal(input.rejectionQty),
        finalApprovedScrapQuantity: new Prisma.Decimal(input.scrapQty),
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId: input.dcId,
        fromStatus: dc.status,
        toStatus: "QUALITY_COMPLETED",
        changedBy: user!.id,
        reason: `Quality Inspection Completed (Good: ${input.goodQty}, Reject: ${input.rejectionQty}, Scrap: ${input.scrapQty}). Decision: ${input.qualityDecision}`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "QUALITY_DECISION_SUBMITTED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: input.dcId,
    reason: `Quality Decision submitted: Decision ${input.qualityDecision} (Good: ${input.goodQty})`,
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

// ---------------- 5A. PRE-OUTWARD MANAGER APPROVAL ----------------

export interface ReviewPreOutwardManagerApprovalInput {
  dcId: string;
  action: "APPROVE" | "REJECT" | "SEND_BACK" | "HOLD";
  approvalRemarks?: string;
}

export async function reviewPreOutwardManagerApproval(input: ReviewPreOutwardManagerApprovalInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_APPROVE);
  if (!permCheck.ok) return permCheck;

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: input.dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  if (dc.status !== "PENDING_APPROVAL" && dc.status !== "DRAFT") {
    return { ok: false, error: `Only PENDING_APPROVAL DCs can undergo Pre-Outward Approval. Current status: ${dc.status}` };
  }

  const remarks = (input.approvalRemarks || "").trim();
  if ((input.action === "SEND_BACK" || input.action === "REJECT") && !remarks) {
    return { ok: false, error: `Reason is mandatory when selecting ${input.action.replace(/_/g, " ")}.` };
  }

  let nextStatus: DcStatus = "APPROVED";
  if (input.action === "APPROVE") nextStatus = "APPROVED";
  else if (input.action === "REJECT") nextStatus = "REJECTED";
  else if (input.action === "SEND_BACK") nextStatus = "SENT_BACK";
  else if (input.action === "HOLD") nextStatus = "HOLD";

  const now = new Date();

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: input.dcId },
      data: {
        status: nextStatus,
        approvalStatus: input.action,
        approvalRemarks: remarks || null,
        approvedBy: user!.id,
        approvedByName: user!.email || "Manager",
        approvedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId: input.dcId,
        fromStatus: dc.status,
        toStatus: nextStatus,
        changedBy: user!.id,
        reason: `Manager Pre-Outward Action: ${input.action}.${remarks ? ` Remarks: ${remarks}` : ""}`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: `MANAGER_PRE_OUTWARD_${input.action}`,
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: input.dcId,
    reason: `Manager Pre-Outward review for DC ${dc.dcNumber}: ${input.action}`,
  });

  revalidatePath(`/dcs/${input.dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ---------------- 5B. POST-QUALITY MANAGER PAYMENT APPROVAL ----------------

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

  let nextStatus: DcStatus = "APPROVED_FOR_PAYMENT";
  if (input.action === "APPROVE") nextStatus = "APPROVED_FOR_PAYMENT";
  else if (input.action === "REJECT") nextStatus = "REJECTED";
  else if (input.action === "SEND_BACK") nextStatus = "SENT_BACK";
  else if (input.action === "HOLD") nextStatus = "HOLD";

  const now = new Date();

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: input.dcId },
      data: {
        status: nextStatus,
        approvalStatus: input.action,
        approvalRemarks: input.approvalRemarks || null,
        finalApprovedBy: user!.id,
        finalApprovedAt: now,

        // Also set payment status if approved
        paymentStatus: input.action === "APPROVE" ? "APPROVED_FOR_PAYMENT" : dc.paymentStatus,
        paymentApprovedBy: input.action === "APPROVE" ? user!.id : dc.paymentApprovedBy,
        paymentApprovedAt: input.action === "APPROVE" ? now : dc.paymentApprovedAt,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId: input.dcId,
        fromStatus: dc.status,
        toStatus: nextStatus,
        changedBy: user!.id,
        reason: `Manager Payment Action: ${input.action}. Remarks: ${input.approvalRemarks || "None"}`,
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

// ---------------- 6. ADMIN CLOSE DC (MANDATORY PAYMENT VALIDATION) ----------------

export async function closeDcByAdmin(dcId: string) {
  return closeDc(dcId);
}
