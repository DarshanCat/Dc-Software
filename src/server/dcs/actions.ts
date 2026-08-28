"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { generateQrToken } from "@/services/dispatch.service";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { notifyUsersWithPermission, createNotification } from "@/server/notifications/service";

// ================= SCHEMAS =================

const createDcSchema = z.object({
  woNumber: z.string().min(1, "WO ID is required").max(60),
  partNumber: z.string().trim().min(1, "Part Number is required.").max(60, "Part Number cannot exceed 60 characters."),
  rmQuantity: z.coerce.number().positive("RM Qty must be > 0."),
  returnFgQuantity: z.coerce.number().positive("Expected Return FG Qty must be > 0."),
  heatNumber: z.string().trim().min(1, "Heat Number is required.").max(60, "Heat Number cannot exceed 60 characters."),
  vendorId: z.string().min(1, "Vendor is required"),
  processId: z.string().min(1, "Process is required"),
  purpose: z.enum([
    "JOB_WORK", "MACHINING", "HEAT_TREATMENT", "SURFACE_TREATMENT",
    "REPAIR", "SAMPLE", "TRIAL", "SUBCONTRACTING", "OTHER",
  ]),
  pricingBasis: z.enum(["RM", "FG"], {
    required_error: "Please select a pricing basis: RM Quantity or FG Quantity.",
    invalid_type_error: "Please select a pricing basis: RM Quantity or FG Quantity.",
  }),
  ratePerQuantity: z.coerce.number().positive("Rate Per Quantity must be greater than zero."),
  preparedByName: z.string().trim().min(1, "Prepared By Name is required.").max(100, "Prepared By Name cannot exceed 100 characters."),
  expectedReturnDate: z.string().optional(),
  ewayBillNumber: z.string().max(60).optional(),
  eSugamNumber: z.string().max(60).optional(),
  remarks: z.string().max(500).optional(),
});

export type CreateDcInput = z.infer<typeof createDcSchema>;

export type ActionResult =
  | { ok: true; dcId: string; dcNumber: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// ================= 1. CREATE DC =================

export async function createDc(input: CreateDcInput): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  try {
    await requirePermission(user, PERMISSIONS.DC_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to create DCs." };
    throw e;
  }

  const parsed = createDcSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const [vendor, processRec] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: data.vendorId } }),
    prisma.process.findUnique({ where: { id: data.processId } }),
  ]);
  if (!vendor) return { ok: false, error: "Selected vendor was not found." };
  if (!vendor.active) return { ok: false, error: "Selected vendor is inactive." };
  if (!processRec) return { ok: false, error: "Selected process was not found." };
  if (!processRec.active) return { ok: false, error: "Selected process is inactive." };

  const qty = data.pricingBasis === "RM" ? data.rmQuantity : data.returnFgQuantity;
  const expectedAmount = Number((qty * data.ratePerQuantity).toFixed(2));

  const now = new Date();
  const fy = fiscalYearOf(now);

  const result = await prisma.$transaction(async (tx) => {
    const dcNumber = await nextNumber(tx, { key: "DC", fiscalYear: fy });
    const qrToken = generateQrToken();

    const dc = await tx.deliveryChallan.create({
      data: {
        dcNumber,
        dcDate: now,
        woNumber: data.woNumber,
        partNumber: data.partNumber.trim(),
        rmQuantity: new Prisma.Decimal(data.rmQuantity),
        returnFgQuantity: new Prisma.Decimal(data.returnFgQuantity),
        heatNumber: data.heatNumber.trim(),
        pricingBasis: data.pricingBasis,
        ratePerQuantity: new Prisma.Decimal(data.ratePerQuantity),
        expectedAmount: new Prisma.Decimal(expectedAmount),
        vendorId: data.vendorId,
        purpose: data.purpose,
        processId: data.processId,
        expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        ewayBillNumber: data.ewayBillNumber || null,
        eSugamNumber: data.eSugamNumber || null,
        remarks: data.remarks || null,
        preparedByName: data.preparedByName.trim(),
        status: "DRAFT",
        createdBy: user.id,
        qrToken,
      },
    });

    await tx.statusHistory.create({
      data: {
        dcId: dc.id,
        toStatus: "DRAFT",
        changedBy: user.id,
        reason: "DC Created",
      },
    });

    return dc;
  });

  await writeAudit(prisma, {
    userId: user.id,
    action: "DC_CREATED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: result.id,
    reason: `DC ${result.dcNumber} created with basis ${data.pricingBasis}`,
  });

  revalidatePath("/dcs");
  return { ok: true, dcId: result.id, dcNumber: result.dcNumber };
}

// ================= 2. SUBMIT FOR APPROVAL (DRAFT -> PENDING_APPROVAL) =================

export async function submitForApproval(dcId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "DRAFT") return { ok: false, error: `Only DRAFT DCs can be submitted. Current status: ${dc.status}` };

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
        changedBy: user.id,
        reason: "Submitted for approval",
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
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
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.DC_APPROVE);

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
        changedBy: user.id,
        reason: `Returned to DRAFT: ${trimmedReason}`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
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
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.DC_APPROVE);

  const trimmed = (approvedByName || "").trim();
  if (!trimmed) return { ok: false, error: "Approved By Name is required." };

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "PENDING_APPROVAL") return { ok: false, error: `Only PENDING_APPROVAL DCs can be approved. Current status: ${dc.status}` };

  // Self-approval control rule: creator cannot approve own DC unless ADMIN
  if (dc.createdBy === user.id && !user.roleKeys.includes("ADMIN")) {
    return { ok: false, error: "You cannot approve a Delivery Challan that you created." };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "APPROVED",
        approvedBy: user.id,
        approvedByName: trimmed,
        approvedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "PENDING_APPROVAL",
        toStatus: "APPROVED",
        changedBy: user.id,
        reason: `Approved by ${trimmed}`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
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

// ================= 5. SECURITY DISPATCH (APPROVED -> DISPATCHED) =================

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
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.SECURITY_DISPATCH);

  if (input.dispatchQuantity <= 0) return { ok: false, error: "Dispatch quantity must be greater than zero." };

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "APPROVED") return { ok: false, error: `DC must be in APPROVED status for dispatch. Current: ${dc.status}` };

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
        securityDispatchedBy: user.id,
        securityDispatchedAt: now,
        dispatchedBy: user.id,
        dispatchedAt: now,
        vehicleNumber: input.vehicleNumber || dc.vehicleNumber,
        transporter: input.transporter || dc.transporter,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "APPROVED",
        toStatus: "DISPATCHED",
        changedBy: user.id,
        reason: `Security Dispatch recorded (${input.dispatchQuantity})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
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
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.DC_VIEW);

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
        changedBy: user.id,
        reason: "Vendor receipt confirmed",
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
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
    securityFgQuantity: number;
    securityRejectionQuantity: number;
    securityScrapQuantity: number;
    returnDate?: string;
    returnTime?: string;
    vehicleNumber?: string;
    transporter?: string;
    remarks?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.SECURITY_RETURN);

  if (input.securityFgQuantity < 0 || input.securityRejectionQuantity < 0 || input.securityScrapQuantity < 0) {
    return { ok: false, error: "Quantities cannot be negative." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (!["DISPATCHED", "AT_VENDOR"].includes(dc.status)) {
    return { ok: false, error: `DC must be DISPATCHED or AT_VENDOR for Security Return. Current: ${dc.status}` };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "SECURITY_RETURNED",
        securityFgQuantity: new Prisma.Decimal(input.securityFgQuantity),
        securityRejectionQuantity: new Prisma.Decimal(input.securityRejectionQuantity),
        securityScrapQuantity: new Prisma.Decimal(input.securityScrapQuantity),
        securityReturnDate: input.returnDate ? new Date(input.returnDate) : now,
        securityReturnTime: input.returnTime || now.toLocaleTimeString(),
        securityVehicleNumber: input.vehicleNumber || null,
        securityTransporter: input.transporter || null,
        securityReturnRemarks: input.remarks || null,
        securityEnteredBy: user.id,
        securityEnteredAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: dc.status,
        toStatus: "SECURITY_RETURNED",
        changedBy: user.id,
        reason: `Security Return recorded (FG: ${input.securityFgQuantity}, Rej: ${input.securityRejectionQuantity}, Scrap: ${input.securityScrapQuantity})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
    action: "SECURITY_RETURN_SUBMITTED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Security Return (FG: ${input.securityFgQuantity})`,
  });

  await notifyUsersWithPermission(
    prisma,
    PERMISSIONS.STORE_VERIFY,
    {
      type: "DC_STATUS",
      title: `Security Return Completed - DC ${dc.dcNumber}`,
      body: `Material returned at gate for DC ${dc.dcNumber}. Store verification required.`,
      entityType: "DeliveryChallan",
      entityId: dcId,
      targetUrl: `/dcs/${dcId}`,
    },
  );

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 8. STORE VERIFICATION (SECURITY_RETURNED -> STORE_VERIFIED) =================

export async function submitStoreVerification(
  dcId: string,
  input: {
    storeVerifiedFgQuantity: number;
    storeVerifiedRejectionQuantity: number;
    storeVerifiedScrapQuantity: number;
    storeRemarks?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.STORE_VERIFY);

  if (input.storeVerifiedFgQuantity < 0 || input.storeVerifiedRejectionQuantity < 0 || input.storeVerifiedScrapQuantity < 0) {
    return { ok: false, error: "Verified quantities cannot be negative." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "SECURITY_RETURNED") {
    return { ok: false, error: `DC must be in SECURITY_RETURNED status for Store Verification. Current: ${dc.status}` };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "STORE_VERIFIED",
        storeVerifiedFgQuantity: new Prisma.Decimal(input.storeVerifiedFgQuantity),
        storeVerifiedRejectionQuantity: new Prisma.Decimal(input.storeVerifiedRejectionQuantity),
        storeVerifiedScrapQuantity: new Prisma.Decimal(input.storeVerifiedScrapQuantity),
        storeRemarks: input.storeRemarks || null,
        storeVerifiedBy: user.id,
        storeVerifiedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "SECURITY_RETURNED",
        toStatus: "STORE_VERIFIED",
        changedBy: user.id,
        reason: `Store Verification completed (FG: ${input.storeVerifiedFgQuantity}, Rej: ${input.storeVerifiedRejectionQuantity}, Scrap: ${input.storeVerifiedScrapQuantity})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
    action: "STORE_VERIFICATION_SUBMITTED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Store Verification (FG: ${input.storeVerifiedFgQuantity})`,
  });

  await notifyUsersWithPermission(
    prisma,
    PERMISSIONS.MANAGER_FINAL_APPROVE,
    {
      type: "DC_STATUS",
      title: `Store Verified - DC ${dc.dcNumber}`,
      body: `Store verification complete for DC ${dc.dcNumber}. Manager final review required.`,
      entityType: "DeliveryChallan",
      entityId: dcId,
      targetUrl: `/dcs/${dcId}`,
    },
  );

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 9. MANAGER FINAL APPROVAL (STORE_VERIFIED -> FINAL_APPROVED) =================

export async function submitManagerFinalApproval(
  dcId: string,
  input: {
    finalApprovedFgQuantity: number;
    finalApprovedRejectionQuantity: number;
    finalApprovedScrapQuantity: number;
    managerCorrectionRemarks?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.MANAGER_FINAL_APPROVE);

  if (input.finalApprovedFgQuantity < 0 || input.finalApprovedRejectionQuantity < 0 || input.finalApprovedScrapQuantity < 0) {
    return { ok: false, error: "Final approved quantities cannot be negative." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "STORE_VERIFIED") {
    return { ok: false, error: `DC must be in STORE_VERIFIED status for Manager Final Approval. Current: ${dc.status}` };
  }

  // Discrepancy detection
  const secTotal = Number(dc.securityFgQuantity ?? 0) + Number(dc.securityRejectionQuantity ?? 0) + Number(dc.securityScrapQuantity ?? 0);
  const storeTotal = input.finalApprovedFgQuantity + input.finalApprovedRejectionQuantity + input.finalApprovedScrapQuantity;
  const hasDiscrepancy = secTotal !== storeTotal || storeTotal !== Number(dc.returnFgQuantity ?? 0);

  const remarks = (input.managerCorrectionRemarks || "").trim();
  if (hasDiscrepancy && !remarks) {
    return { ok: false, error: "Correction remarks are mandatory when quantities differ." };
  }

  // Calculate final payable amount
  const rate = Number(dc.ratePerQuantity ?? 0);
  let finalPayable = 0;
  if (dc.pricingBasis === "RM") {
    finalPayable = Number(dc.rmQuantity ?? 0) * rate;
  } else {
    finalPayable = input.finalApprovedFgQuantity * rate;
  }
  finalPayable = Number(finalPayable.toFixed(2));

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "FINAL_APPROVED",
        finalApprovedFgQuantity: new Prisma.Decimal(input.finalApprovedFgQuantity),
        finalApprovedRejectionQuantity: new Prisma.Decimal(input.finalApprovedRejectionQuantity),
        finalApprovedScrapQuantity: new Prisma.Decimal(input.finalApprovedScrapQuantity),
        managerCorrectionRemarks: remarks || null,
        finalApprovedBy: user.id,
        finalApprovedAt: now,
        finalPayableAmount: new Prisma.Decimal(finalPayable),
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "STORE_VERIFIED",
        toStatus: "FINAL_APPROVED",
        changedBy: user.id,
        reason: `Final approved quantities set (Payable: ₹${finalPayable})`,
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
    action: "MANAGER_FINAL_APPROVAL_SUBMITTED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Final Approved Payable ₹${finalPayable}`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 10. APPROVE FOR PAYMENT (FINAL_APPROVED -> APPROVED_FOR_PAYMENT) =================

export async function submitPaymentApproval(dcId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.PAYMENT_APPROVE);

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "FINAL_APPROVED") {
    return { ok: false, error: `DC must be in FINAL_APPROVED status for Payment Approval. Current: ${dc.status}` };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "APPROVED_FOR_PAYMENT",
        approvedForPaymentBy: user.id,
        approvedForPaymentAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "FINAL_APPROVED",
        toStatus: "APPROVED_FOR_PAYMENT",
        changedBy: user.id,
        reason: "Approved for payment",
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
    action: "DC_APPROVED_FOR_PAYMENT",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: "Approved for payment",
  });

  await notifyUsersWithPermission(
    prisma,
    PERMISSIONS.ACCOUNTS_PAYMENT_ENTRY,
    {
      type: "DC_STATUS",
      title: `Approved for Payment - DC ${dc.dcNumber}`,
      body: `DC ${dc.dcNumber} approved for payment. Accounts entry required.`,
      entityType: "DeliveryChallan",
      entityId: dcId,
      targetUrl: `/dcs/${dcId}`,
    },
  );

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 11. ACCOUNTS PAYMENT ENTRY (REMAINS APPROVED_FOR_PAYMENT) =================

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
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.ACCOUNTS_PAYMENT_ENTRY);

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

  await writeAudit(prisma, {
    userId: user.id,
    action: "ACCOUNTS_PAYMENT_ENTRY_RECORDED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: `Recorded Invoice ${invNum} (Amt: ₹${input.invoiceAmount}, Ref: ${payRef})`,
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}

// ================= 12. UPDATE TRANSPORT DETAILS =================

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
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.DC_EDIT);

  await prisma.deliveryChallan.update({
    where: { id: dcId },
    data: {
      vehicleNumber: input.vehicleNumber || null,
      transporter: input.transporter || null,
      ewayBillNumber: input.ewayBillNumber || null,
      eSugamNumber: input.eSugamNumber || null,
    },
  });

  revalidatePath(`/dcs/${dcId}`);
  return { ok: true };
}

// ================= 13. CLOSE DC (APPROVED_FOR_PAYMENT -> CLOSED) =================

export async function closeDc(dcId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await requirePermission(user, PERMISSIONS.DC_CLOSE);

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "APPROVED_FOR_PAYMENT") {
    return { ok: false, error: `DC must be in APPROVED_FOR_PAYMENT status to close. Current: ${dc.status}` };
  }

  // Mandatory closure validations
  const missingFields: string[] = [];
  if (!dc.invoiceNumber || !dc.invoiceNumber.trim()) missingFields.push("Invoice Number");
  if (!dc.invoiceDate) missingFields.push("Invoice Date");
  if (!dc.invoiceAmount || Number(dc.invoiceAmount) <= 0) missingFields.push("Invoice Amount");
  if (!dc.paymentReferenceNumber || !dc.paymentReferenceNumber.trim()) missingFields.push("Payment Reference Number");
  if (!dc.paymentDate) missingFields.push("Payment Date");

  if (missingFields.length > 0) {
    return {
      ok: false,
      error: `Cannot close DC. Please complete: ${missingFields.join(", ")}.`,
    };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "CLOSED",
        closedBy: user.id,
        closedAt: now,
      },
    }),
    prisma.statusHistory.create({
      data: {
        dcId,
        fromStatus: "APPROVED_FOR_PAYMENT",
        toStatus: "CLOSED",
        changedBy: user.id,
        reason: "DC Closed after mandatory payment verification",
      },
    }),
  ]);

  await writeAudit(prisma, {
    userId: user.id,
    action: "DC_CLOSED",
    module: "DeliveryChallan",
    entityType: "DeliveryChallan",
    entityId: dcId,
    reason: "Delivery Challan closed with complete payment details",
  });

  revalidatePath(`/dcs/${dcId}`);
  revalidatePath("/dcs");
  return { ok: true };
}