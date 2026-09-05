"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, hasPermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { generateQrToken } from "@/services/dispatch.service";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { notifyUsersWithPermission, createNotification } from "@/server/notifications/service";

// Helper to safely verify permissions without throwing unhandled exceptions into Next.js action boundary
async function checkPermission(
  user: any,
  permission: string
): Promise<{ ok: true } | { ok: false; error: string }> {
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

// ================= SCHEMAS =================

const createDcSchema = z.object({
  movementType: z.enum(["MATERIAL", "TOOL", "COMPANY_PROPERTY"]).default("MATERIAL"),
  isCommercialService: z.boolean().default(false),
  destinationDepartment: z.string().optional(),
  responsibleCustodian: z.string().optional(),
  woNumber: z.string().max(60).optional(),
  partNumber: z.string().trim().max(60).optional(),
  rmQuantity: z.coerce.number().optional(),
  returnFgQuantity: z.coerce.number().optional(),
  heatNumber: z.string().trim().max(60).optional(),
  vendorId: z.string().optional(),
  processId: z.string().optional(),
  purpose: z.enum([
    "JOB_WORK", "MACHINING", "HEAT_TREATMENT", "SURFACE_TREATMENT",
    "REPAIR", "SAMPLE", "TRIAL", "SUBCONTRACTING", "OTHER",
  ]),
  pricingBasis: z.enum(["RM", "FG"]).optional(),
  ratePerQuantity: z.coerce.number().optional(),
  preparedByName: z.string().trim().min(1, "Prepared By Name is required.").max(100, "Prepared By Name cannot exceed 100 characters."),
  expectedReturnDate: z.string().optional(),
  ewayBillNumber: z.string().max(60).optional(),
  eSugamNumber: z.string().max(60).optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(z.object({
    itemCode: z.string().optional(),
    itemDescription: z.string().min(1, "Item description is required"),
    quantity: z.coerce.number().positive("Quantity must be > 0"),
    uom: z.string().default("NOS"),
    conditionIn: z.string().optional(),
    toolInstanceId: z.string().optional(),
    assetMasterId: z.string().optional(),
  })).optional(),
}).superRefine((val, ctx) => {
  if (val.movementType === "MATERIAL") {
    if (!val.vendorId || !val.vendorId.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Supplier / Vendor is required for Material DCs.", path: ["vendorId"] });
    }
    if (!val.woNumber || !val.woNumber.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "WO ID is required for Material DCs.", path: ["woNumber"] });
    }
    if (!val.partNumber || !val.partNumber.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Part Number is required for Material DCs.", path: ["partNumber"] });
    }
    if (!val.rmQuantity || val.rmQuantity <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "RM Qty must be > 0 for Material DCs.", path: ["rmQuantity"] });
    }
    if (!val.returnFgQuantity || val.returnFgQuantity <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected Return FG Qty must be > 0 for Material DCs.", path: ["returnFgQuantity"] });
    }
    if (!val.heatNumber || !val.heatNumber.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Heat Number is required for Material DCs.", path: ["heatNumber"] });
    }
    if (!val.processId || !val.processId.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Process is required for Material DCs.", path: ["processId"] });
    }
    if (!val.pricingBasis) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select a pricing basis: RM Quantity or FG Quantity.", path: ["pricingBasis"] });
    }
    if (!val.ratePerQuantity || val.ratePerQuantity <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rate Per Quantity must be greater than zero.", path: ["ratePerQuantity"] });
    }
  } else if (val.isCommercialService) {
    if (!val.vendorId || !val.vendorId.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Supplier / Vendor is required for Commercial Service DCs.", path: ["vendorId"] });
    }
  }
});

export type CreateDcInput = z.infer<typeof createDcSchema>;

export type ActionResult =
  | { ok: true; dcId: string; dcNumber: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// ================= 1. CREATE DC =================

export async function createDc(input: CreateDcInput): Promise<ActionResult> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_CREATE);
  if (!permCheck.ok) return permCheck;

  const parsed = createDcSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  let vendor: any = null;
  if (data.vendorId) {
    vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
    if (!vendor) return { ok: false, error: "Selected vendor was not found." };
    if (!vendor.active) return { ok: false, error: "Selected vendor is inactive." };
  }

  if (data.processId) {
    const processRec = await prisma.process.findUnique({ where: { id: data.processId } });
    if (!processRec) return { ok: false, error: "Selected process was not found." };
    if (!processRec.active) return { ok: false, error: "Selected process is inactive." };
  }

  let expectedAmount = 0;
  if (data.movementType === "MATERIAL" && data.pricingBasis && data.ratePerQuantity) {
    const qty = data.pricingBasis === "RM" ? (data.rmQuantity || 0) : (data.returnFgQuantity || 0);
    expectedAmount = Number((qty * data.ratePerQuantity).toFixed(2));
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
        movementType: data.movementType,
        isCommercialService: data.isCommercialService,
        destinationDepartment: data.destinationDepartment || null,
        responsibleCustodian: data.responsibleCustodian || null,
        woNumber: data.woNumber || "N/A",
        partNumber: data.partNumber ? data.partNumber.trim() : null,
        rmQuantity: data.rmQuantity ? new Prisma.Decimal(data.rmQuantity) : null,
        returnFgQuantity: data.returnFgQuantity ? new Prisma.Decimal(data.returnFgQuantity) : null,
        heatNumber: data.heatNumber ? data.heatNumber.trim() : null,
        pricingBasis: data.pricingBasis || null,
        ratePerQuantity: data.ratePerQuantity ? new Prisma.Decimal(data.ratePerQuantity) : null,
        expectedAmount: expectedAmount > 0 ? new Prisma.Decimal(expectedAmount) : null,
        vendorId: data.vendorId || null,
        supplierNameSnapshot: vendor ? vendor.vendorName : null,
        supplierAddressSnapshot: vendor ? (vendor.address || `${vendor.city || ""}, ${vendor.state || ""}`) : null,
        supplierGstSnapshot: vendor ? (vendor.gstNumber || null) : null,
        purpose: data.purpose,
        processId: data.processId || null,
        expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        ewayBillNumber: data.ewayBillNumber || null,
        eSugamNumber: data.eSugamNumber || null,
        remarks: data.remarks || null,
        preparedByName: data.preparedByName.trim(),
        status: "DRAFT",
        createdBy: user!.id,
        qrToken,
      },
    });

    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await tx.deliveryChallanItem.create({
          data: {
            dcId: dc.id,
            itemCode: item.itemCode || null,
            itemDescription: item.itemDescription.trim(),
            quantity: new Prisma.Decimal(item.quantity),
            uom: item.uom || "NOS",
            conditionIn: item.conditionIn || null,
            toolInstanceId: item.toolInstanceId || null,
            assetMasterId: item.assetMasterId || null,
          },
        });
      }
    }

    await tx.statusHistory.create({
      data: {
        dcId: dc.id,
        toStatus: "DRAFT",
        changedBy: user!.id,
        reason: `DC Created (${data.movementType})`,
      },
    });

    return dc;
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "DC_CREATED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: result.id,
    reason: `DC ${result.dcNumber} created (${data.movementType})`,
  });

  revalidatePath("/dcs");
  return { ok: true, dcId: result.id, dcNumber: result.dcNumber };
}

// ================= 2. SUBMIT FOR APPROVAL (DRAFT -> PENDING_APPROVAL) =================

export async function submitForApproval(dcId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_CREATE);
  if (!permCheck.ok) return permCheck;

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "DRAFT") return { ok: false, error: `Only DRAFT DCs can be submitted. Current status: ${dc.status}` };

  if (dc.movementType !== "MATERIAL") {
    return { ok: false, error: "Other DCs (Tool / Company Property) do not require Manager approval and can be dispatched directly from DRAFT." };
  }

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: { status: "PENDING_APPROVAL" },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "DRAFT",
        toStatus: "PENDING_APPROVAL",
        changedBy: user!.id,
        reason: "Submitted for approval",
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "DC_SUBMITTED_FOR_APPROVAL",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `DC ${dc.dcNumber} submitted for approval`,
  });

  await notifyUsersWithPermission(
    prisma,
    PERMISSIONS.DC_APPROVE,
    {
      type: "DC_STATUS",
      title: `DC ${dc.dcNumber} Submitted`,
      body: `Delivery Challan ${dc.dcNumber} is pending approval.`,
      entityType: "DeliveryChallan",
      entityId: dcId,
      targetUrl: `/dcs/${dcId}`,
    },
  );

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 3. REJECT TO DRAFT (PENDING_APPROVAL -> DRAFT) =================

export async function rejectDcToDraft(dcId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_APPROVE);
  if (!permCheck.ok) return permCheck;

  const trimmedReason = (reason || "").trim();
  if (!trimmedReason) return { ok: false, error: "Return remarks are mandatory." };

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "PENDING_APPROVAL") return { ok: false, error: `Only PENDING_APPROVAL DCs can be returned. Current status: ${dc.status}` };

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: { status: "DRAFT" },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "PENDING_APPROVAL",
        toStatus: "DRAFT",
        changedBy: user!.id,
        reason: `Returned to DRAFT: ${trimmedReason}`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "DC_RETURNED_TO_DRAFT",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Returned to DRAFT: ${trimmedReason}`,
  });

  if (dc.createdBy) {
    await createNotification(prisma, {
      userId: dc.createdBy,
      type: "DC_STATUS",
      title: `DC ${dc.dcNumber} Returned to Draft`,
      body: `Your DC ${dc.dcNumber} was returned for correction: ${trimmedReason}`,
      entityType: "DeliveryChallan",
      entityId: dcId,
      targetUrl: `/dcs/${dcId}`,
    });
  }

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 4. APPROVE DC (PENDING_APPROVAL -> APPROVED) =================

export async function approveDc(dcId: string, approvedByName: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_APPROVE);
  if (!permCheck.ok) return permCheck;

  const trimmed = (approvedByName || "").trim();
  if (!trimmed) return { ok: false, error: "Approved By Name is required." };

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "PENDING_APPROVAL") return { ok: false, error: `Only PENDING_APPROVAL DCs can be approved. Current status: ${dc.status}` };

  if (dc.createdBy === user!.id && !user!.roleKeys.includes("ADMIN")) {
    return { ok: false, error: "You cannot approve a Delivery Challan that you created." };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "APPROVED",
        approvedBy: user!.id,
        approvedByName: trimmed,
        approvedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "PENDING_APPROVAL",
        toStatus: "APPROVED",
        changedBy: user!.id,
        reason: `Approved by ${trimmed}`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "DC_APPROVED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Approved by ${trimmed}`,
  });

  await notifyUsersWithPermission(
    prisma,
    PERMISSIONS.SECURITY_DISPATCH,
    {
      type: "DC_STATUS",
      title: `DC ${dc.dcNumber} Approved`,
      body: `DC ${dc.dcNumber} is approved and ready for Security dispatch entry.`,
      entityType: "DeliveryChallan",
      entityId: dcId,
      targetUrl: `/dcs/${dcId}`,
    },
  );

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 5. SECURITY DISPATCH (APPROVED/DRAFT -> DISPATCHED) =================

export async function submitSecurityDispatch(
  dcId: string,
  input: {
    dispatchQuantity: number;
    dispatchDate?: string;
    dispatchTime?: string;
    vehicleNumber?: string;
    transporter?: string;
    remarks?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SECURITY_DISPATCH);
  if (!permCheck.ok) return permCheck;

  if (input.dispatchQuantity <= 0) return { ok: false, error: "Dispatch quantity must be greater than zero." };

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  if (dc.movementType === "MATERIAL") {
    if (dc.status !== "APPROVED") return { ok: false, error: `Material DC must be in APPROVED status for dispatch. Current: ${dc.status}` };
  } else {
    if (dc.status !== "DRAFT" && dc.status !== "APPROVED") return { ok: false, error: `Other DC must be in DRAFT or APPROVED status for dispatch. Current: ${dc.status}` };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "DISPATCHED",
        securityDispatchQuantity: new Prisma.Decimal(input.dispatchQuantity),
        securityDispatchDate: input.dispatchDate ? new Date(input.dispatchDate) : now,
        securityDispatchTime: input.dispatchTime || now.toLocaleTimeString(),
        securityDispatchVehicleNumber: input.vehicleNumber || null,
        securityDispatchTransporter: input.transporter || null,
        securityDispatchRemarks: input.remarks || null,
        securityDispatchedBy: user!.id,
        securityDispatchedAt: now,
        dispatchedBy: user!.id,
        dispatchedAt: now,
        vehicleNumber: input.vehicleNumber || dc.vehicleNumber,
        transporter: input.transporter || dc.transporter,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: dc.status,
        toStatus: "DISPATCHED",
        changedBy: user!.id,
        reason: `Security Dispatch recorded (${input.dispatchQuantity})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "SECURITY_DISPATCH_SUBMITTED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Dispatched quantity ${input.dispatchQuantity}`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 6. CONFIRM VENDOR RECEIPT (DISPATCHED -> AT_VENDOR) =================

export async function confirmDcAtVendor(dcId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_VIEW);
  if (!permCheck.ok) return permCheck;

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "DISPATCHED") return { ok: false, error: `DC must be in DISPATCHED status. Current: ${dc.status}` };

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: { status: "AT_VENDOR" },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "DISPATCHED",
        toStatus: "AT_VENDOR",
        changedBy: user!.id,
        reason: "Vendor receipt confirmed",
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "VENDOR_RECEIPT_CONFIRMED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: "Vendor receipt confirmed",
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 7. SECURITY RETURN ENTRY (AT_VENDOR/DISPATCHED -> SECURITY_RETURNED) =================

export async function submitSecurityReturn(
  dcId: string,
  input: {
    actualInwardQty: number;
    inwardDate?: string;
    inwardDocumentNo?: string;
    invoiceNumber?: string;
    vehicleNumber?: string;
    transporter?: string;
    remarks?: string;
    storeGatingWeight?: any;
    storeBoringWeight?: any;
    goodQty?: any;
    rejectionQty?: any;
    scrapQty?: any;
    qualityDecision?: any;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.SECURITY_RETURN);
  if (!permCheck.ok) return permCheck;

  if (
    input.storeGatingWeight !== undefined ||
    input.storeBoringWeight !== undefined ||
    input.goodQty !== undefined ||
    input.rejectionQty !== undefined ||
    input.scrapQty !== undefined ||
    input.qualityDecision !== undefined
  ) {
    return { ok: false, error: "Security action cannot accept weights or Quality classification fields." };
  }

  if (input.actualInwardQty <= 0) {
    return { ok: false, error: "Actual Inward Quantity must be greater than zero." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (!["DISPATCHED", "AT_VENDOR"].includes(dc.status)) {
    return { ok: false, error: `DC must be DISPATCHED or AT_VENDOR for Security Return. Current: ${dc.status}` };
  }

  const now = new Date();
  const inwardDate = input.inwardDate ? new Date(input.inwardDate) : now;

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "SECURITY_RETURNED",
        actualInwardQty: new Prisma.Decimal(input.actualInwardQty),
        securityFgQuantity: new Prisma.Decimal(input.actualInwardQty),
        inwardDate,
        inwardDocumentNo: input.inwardDocumentNo || null,
        invoiceNumber: input.invoiceNumber || dc.invoiceNumber,
        securityReturnDate: inwardDate,
        securityReturnTime: now.toLocaleTimeString(),
        securityVehicleNumber: input.vehicleNumber || null,
        securityTransporter: input.transporter || null,
        securityReturnRemarks: input.remarks || null,
        securityEnteredBy: user!.id,
        securityEnteredAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: dc.status,
        toStatus: "SECURITY_RETURNED",
        changedBy: user!.id,
        reason: `Security Inward recorded (Actual Inward: ${input.actualInwardQty})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "SECURITY_INWARD_RECORDED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Security Inward recorded (Actual Inward Qty: ${input.actualInwardQty})`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 8. STORE VERIFICATION (SECURITY_RETURNED -> STORE_VERIFIED) =================

export async function submitStoreVerification(
  dcId: string,
  input: {
    storeReceivedQty: number;
    storeReceivedDate?: string;
    storeGatingWeight?: number;
    storeBoringWeight?: number;
    storeRemarks?: string;
    goodQty?: any;
    rejectionQty?: any;
    scrapQty?: any;
    qualityDecision?: any;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.STORE_VERIFY);
  if (!permCheck.ok) return permCheck;

  if (
    input.goodQty !== undefined ||
    input.rejectionQty !== undefined ||
    input.scrapQty !== undefined ||
    input.qualityDecision !== undefined
  ) {
    return { ok: false, error: "Store action cannot accept Quality classification fields." };
  }

  if (input.storeReceivedQty <= 0) {
    return { ok: false, error: "Store Received Quantity must be greater than zero." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "SECURITY_RETURNED") {
    return { ok: false, error: `DC must be in SECURITY_RETURNED status for Store Verification. Current: ${dc.status}` };
  }
  if (dc.movementType && dc.movementType !== "MATERIAL") {
    return { ok: false, error: "Store verification is strictly for Material DCs. Use Custodian Verification for Other DCs." };
  }

  const now = new Date();
  const storeDate = input.storeReceivedDate ? new Date(input.storeReceivedDate) : now;

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "STORE_VERIFIED",
        storeReceivedQty: new Prisma.Decimal(input.storeReceivedQty),
        storeVerifiedFgQuantity: new Prisma.Decimal(input.storeReceivedQty),
        storeReceivedDate: storeDate,
        storeGatingWeight: input.storeGatingWeight ? new Prisma.Decimal(input.storeGatingWeight) : null,
        storeBoringWeight: input.storeBoringWeight ? new Prisma.Decimal(input.storeBoringWeight) : null,
        storeRemarks: input.storeRemarks || null,
        storeVerifiedBy: user!.id,
        storeVerifiedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "SECURITY_RETURNED",
        toStatus: "STORE_VERIFIED",
        changedBy: user!.id,
        reason: `Store Verification completed (Received Qty: ${input.storeReceivedQty})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "STORE_RECEIPT_CONFIRMED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Store confirmed quantity ${input.storeReceivedQty}`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 8B. CUSTODIAN VERIFICATION (OTHER DCS: SECURITY_RETURNED -> CUSTODIAN_VERIFIED / APPROVED_FOR_PAYMENT) =================

export async function submitCustodianVerification(
  dcId: string,
  input: {
    items?: Array<{
      id: string;
      returnedQuantity: number;
      conditionIn?: string;
    }>;
    remarks?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_VIEW);
  if (!permCheck.ok) return permCheck;

  const dc = await prisma.deliveryChallan.findUnique({
    where: { id: dcId },
    include: { items: true },
  });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "SECURITY_RETURNED") {
    return { ok: false, error: `DC must be in SECURITY_RETURNED status for Custodian Verification. Current: ${dc.status}` };
  }
  if (dc.movementType === "MATERIAL") {
    return { ok: false, error: "Material DCs must be verified by Store. Use Store Verification." };
  }

  const now = new Date();
  const nextStatus = dc.isCommercialService ? "APPROVED_FOR_PAYMENT" : "CUSTODIAN_VERIFIED";

  await prisma.$transaction(async (tx) => {
    if (input.items && input.items.length > 0) {
      for (const item of input.items) {
        await tx.deliveryChallanItem.update({
          where: { id: item.id },
          data: {
            returnedQuantity: new Prisma.Decimal(item.returnedQuantity),
            conditionIn: item.conditionIn || null,
          },
        });
      }
    }

    await tx.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: nextStatus,
        storeRemarks: input.remarks || dc.storeRemarks,
      },
    });

    await tx.statusHistory.create({
      data: {
        dcId,
        fromStatus: "SECURITY_RETURNED",
        toStatus: nextStatus,
        changedBy: user!.id,
        reason: `Custodian Verification completed by ${user!.email}`,
      },
    });
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "CUSTODIAN_VERIFICATION_SUBMITTED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Custodian verification recorded for ${dc.dcNumber}`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 9. MANAGER PAYMENT APPROVAL (QUALITY_COMPLETED -> APPROVED_FOR_PAYMENT) =================

export async function submitPaymentApproval(
  dcId: string,
  input?: {
    goodQty?: any;
    rejectionQty?: any;
    scrapQty?: any;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.PAYMENT_APPROVE);
  if (!permCheck.ok) return permCheck;

  if (
    input?.goodQty !== undefined ||
    input?.rejectionQty !== undefined ||
    input?.scrapQty !== undefined
  ) {
    return { ok: false, error: "Manager action cannot modify Quality classification quantities." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  if (dc.status !== "QUALITY_COMPLETED" && dc.status !== "FINAL_APPROVED" && !(dc.isCommercialService && dc.status === "CUSTODIAN_VERIFIED")) {
    return { ok: false, error: `DC must be in QUALITY_COMPLETED status for Payment Approval. Current: ${dc.status}` };
  }

  const rate = Number(dc.ratePerQuantity ?? 0);
  let finalPayable = 0;

  if (dc.pricingBasis === "RM") {
    const rmQty = Number(dc.rmQuantity ?? dc.outwardQtyRw ?? 0);
    finalPayable = Number((rmQty * rate).toFixed(2));
  } else {
    if (dc.goodQty === null || dc.goodQty === undefined) {
      return { ok: false, error: "Quality inspection (Good Qty) is required before payment approval." };
    }
    const good = Number(dc.goodQty);
    finalPayable = Number((good * rate).toFixed(2));
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "APPROVED_FOR_PAYMENT",
        approvedForPaymentBy: user!.id,
        approvedForPaymentAt: now,
        finalPayableAmount: new Prisma.Decimal(finalPayable),
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: dc.status,
        toStatus: "APPROVED_FOR_PAYMENT",
        changedBy: user!.id,
        reason: `Approved for payment (Final Payable: ₹${finalPayable})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "MANAGER_PAYMENT_APPROVED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Approved for payment (Final Payable: ₹${finalPayable})`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

export async function submitManagerFinalApproval(
  dcId: string,
  _input: any,
): Promise<{ ok: boolean; error?: string }> {
  return submitPaymentApproval(dcId);
}

// ================= 10. ACCOUNTS PAYMENT ENTRY (REMAINS APPROVED_FOR_PAYMENT) =================

export async function submitAccountsPaymentEntry(
  dcId: string,
  input: {
    invoiceNumber: string;
    invoiceDate: string;
    invoiceAmount: number;
    paymentReferenceNumber: string;
    paymentDate: string;
    paymentRemarks?: string;
  },
): Promise<{ ok: boolean; error?: string; closeEligibility?: { eligible: boolean; missingFields: string[] } }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.ACCOUNTS_PAYMENT_ENTRY);
  if (!permCheck.ok) return permCheck;

  const missing: string[] = [];
  const invNum = (input.invoiceNumber || "").trim();
  if (!invNum) missing.push("Invoice Number");
  if (!input.invoiceDate) missing.push("Invoice Date");
  if (!input.invoiceAmount || input.invoiceAmount <= 0) missing.push("Invoice Amount (> 0)");
  const payRef = (input.paymentReferenceNumber || "").trim();
  if (!payRef) missing.push("Payment Reference Number");
  if (!input.paymentDate) missing.push("Payment Date");

  if (missing.length > 0) {
    return { ok: false, error: `Cannot save payment details. Please complete: ${missing.join(", ")}.` };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "APPROVED_FOR_PAYMENT") {
    return { ok: false, error: `DC must be in APPROVED_FOR_PAYMENT status for Accounts Entry. Current: ${dc.status}` };
  }

  await prisma.deliveryChallan.update({
    where: { id: dcId },
    data: {
      invoiceNumber: invNum,
      invoiceDate: new Date(input.invoiceDate),
      invoiceAmount: new Prisma.Decimal(input.invoiceAmount),
      paymentReferenceNumber: payRef,
      paymentDate: new Date(input.paymentDate),
      paymentRemarks: input.paymentRemarks || null,
    },
  });

  const closeEligibility = await canCloseDc(dcId, user!.id);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "PAYMENT_ENTRY_COMPLETED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Recorded Invoice ${invNum} (Amt: ₹${input.invoiceAmount}, Ref: ${payRef})`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true, closeEligibility };
}

// ================= 11. SINGLE AUTHORITATIVE CAN_CLOSE_DC VALIDATION =================

export async function canCloseDc(
  dcId: string,
  userId?: string,
): Promise<{ eligible: boolean; missingFields: string[] }> {
  const dc = await prisma.deliveryChallan.findUnique({
    where: { id: dcId },
    include: { items: true },
  });
  if (!dc) return { eligible: false, missingFields: ["DC not found"] };

  const missing: string[] = [];

  if (userId) {
    const userCanClose = await hasPermission(userId, PERMISSIONS.DC_CLOSE);
    if (!userCanClose) missing.push("Missing DC_CLOSE permission");
  }

  const isMaterialOrCommercial = !dc.movementType || dc.movementType === "MATERIAL" || dc.isCommercialService;

  if (isMaterialOrCommercial) {
    if (dc.status !== "APPROVED_FOR_PAYMENT") missing.push("Status must be APPROVED_FOR_PAYMENT");
    if (!dc.invoiceNumber || !dc.invoiceNumber.trim()) missing.push("Missing invoice number");
    if (!dc.invoiceDate) missing.push("Missing invoice date");
    if (!dc.invoiceAmount || Number(dc.invoiceAmount) <= 0) missing.push("Invoice amount must be greater than zero");
    if (!dc.paymentReferenceNumber || !dc.paymentReferenceNumber.trim()) missing.push("Missing payment reference number");
    if (!dc.paymentDate) missing.push("Missing payment date");
  } else {
    // Non-commercial Other DC (Tool / Company Property)
    if (dc.status !== "CUSTODIAN_VERIFIED" && dc.status !== "CLOSED") {
      missing.push("Status must be CUSTODIAN_VERIFIED for non-commercial DC closure");
    }
    if (!dc.actualInwardQty && !dc.securityReturnDate) {
      missing.push("Security inward return record is missing");
    }
  }

  return { eligible: missing.length === 0, missingFields: missing };
}

// ================= 12. CLOSE DC =================

export async function closeDc(dcId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_CLOSE);
  if (!permCheck.ok) return permCheck;

  const check = await canCloseDc(dcId, user!.id);
  if (!check.eligible) {
    return {
      ok: false,
      error: `DC cannot be closed. Missing requirements: ${check.missingFields.join(", ")}.`,
    };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  const now = new Date();

  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "CLOSED",
        closedBy: user!.id,
        closedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: dc.status,
        toStatus: "CLOSED",
        changedBy: user!.id,
        reason: dc.movementType === "MATERIAL" || dc.isCommercialService
          ? "DC Closed after mandatory payment verification"
          : "DC Closed after custodian return verification",
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user!.id,
    action: "DC_CLOSED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `DC ${dc.dcNumber} closed (${dc.movementType})`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

export async function updateDcTransportDetails(
  dcId: string,
  input: {
    vehicleNumber?: string;
    transporter?: string;
    ewayBillNumber?: string;
    eSugamNumber?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.DC_CREATE);
  if (!permCheck.ok) return permCheck;

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  await prisma.deliveryChallan.update({
    where: { id: dcId },
    data: {
      vehicleNumber: input.vehicleNumber !== undefined ? input.vehicleNumber : dc.vehicleNumber,
      transporter: input.transporter !== undefined ? input.transporter : dc.transporter,
      ewayBillNumber: input.ewayBillNumber !== undefined ? input.ewayBillNumber : dc.ewayBillNumber,
      eSugamNumber: input.eSugamNumber !== undefined ? input.eSugamNumber : dc.eSugamNumber,
    },
  });

  revalidatePath(`/dcs/${dcId}`);
  return { ok: true };
}