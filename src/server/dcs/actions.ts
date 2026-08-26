"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, assertVendorScope, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { computeExpected } from "@/services/reconciliation.service";
import { generateQrToken } from "@/services/dispatch.service";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { notifyUsersWithPermission, createNotification } from "@/server/notifications/service";

const dcLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  inputWeight: z.coerce.number().positive("Input weight must be > 0"),
});

const createDcSchema = z.object({
  woNumber: z.string().min(1, "WO ID is required").max(60),
  partNumber: z.string().trim().min(1, "Part Number is required.").max(60, "Part Number cannot exceed 60 characters."),
  expectedScrap: z.coerce.number().min(0, "Expected scrap cannot be negative.").optional().default(0),
  vendorId: z.string().min(1, "Vendor is required"),
  processId: z.string().min(1, "Process is required"),
  purpose: z.enum([
    "JOB_WORK","MACHINING","HEAT_TREATMENT","SURFACE_TREATMENT",
    "REPAIR","SAMPLE","TRIAL","SUBCONTRACTING","OTHER",
  ]),
  items: z.array(dcLineSchema).min(1, "Add at least one item line."),
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

export async function createDc(input: CreateDcInput): Promise<ActionResult> {
  const user = await getSessionUser();
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

  const duplicateItem = data.items.find((l, i) => data.items.findIndex((o) => o.itemId === l.itemId) !== i);
  if (duplicateItem) {
    return { ok: false, error: "Duplicate item in lines. Combine quantities into one line instead." };
  }

  const itemIds = [...new Set(data.items.map((l) => l.itemId))];
  const itemsById = new Map(
    (await prisma.item.findMany({ where: { id: { in: itemIds } } })).map((i) => [i.id, i]),
  );
  const missingItem = data.items.some((l) => !itemsById.has(l.itemId));
  if (missingItem) {
    return { ok: false, error: "One or more selected items were not found." };
  }

  const lineData = [] as Array<{
    itemId: string;
    quantity: number;
    uom: string;
    inputWeight: number;
    expectedFinishedWeight: string;
    expectedScrapWeight: string;
    expectedProcessLoss: string;
    tolerancePercentage: number;
    jobWorkStandardId: string | null;
  }>;
  for (const line of data.items) {
    const standard = await prisma.jobWorkStandard.findFirst({
      where: { itemId: line.itemId, processId: data.processId, approved: true },
      orderBy: { revision: "desc" },
    });

    const expected = standard
      ? computeExpected(
          {
            inputWeight: line.inputWeight,
            calculationType: standard.calculationType,
            expectedScrapPercentage: standard.expectedScrapPercentage?.toString() ?? "0",
            allowedProcessLossPercentage: standard.allowedProcessLossPercentage?.toString() ?? "0",
            expectedOutputWeight: standard.expectedOutputWeight.toString(),
            expectedScrapWeight: standard.expectedScrapWeight.toString(),
            allowedProcessLoss: standard.allowedProcessLoss.toString(),
          },
          standard.tolerancePercentage.toString(),
        )
      : {
          expectedFinishedWeight: line.inputWeight.toFixed(3),
          expectedScrapWeight: "0.000",
          allowedProcessLoss: "0.000",
          expectedAccounted: line.inputWeight.toFixed(3),
          balances: true,
        };

    lineData.push({
      itemId: line.itemId,
      quantity: line.quantity,
      uom: itemsById.get(line.itemId)?.defaultUOM || "NOS",
      inputWeight: line.inputWeight,
      expectedFinishedWeight: expected.expectedFinishedWeight,
      expectedScrapWeight: expected.expectedScrapWeight,
      expectedProcessLoss: expected.allowedProcessLoss,
      tolerancePercentage: Number(standard?.tolerancePercentage ?? 0),
      jobWorkStandardId: standard?.id ?? null,
    });
  }

  const now = new Date();
  const fy = fiscalYearOf(now);

  const result = await prisma.$transaction(async (tx) => {
    const dcNumber = await nextNumber(tx, { key: "DC", fiscalYear: fy });

    const dc = await tx.deliveryChallan.create({
      data: {
        dcNumber,
        dcDate: now,
        woNumber: data.woNumber,
        partNumber: data.partNumber.trim(),
        expectedScrap: data.expectedScrap != null ? new Prisma.Decimal(data.expectedScrap) : null,
        vendorId: data.vendorId,
        purpose: data.purpose,
        processId: data.processId,
        expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        ewayBillNumber: data.ewayBillNumber || null,
        eSugamNumber: data.eSugamNumber || null,
        remarks: data.remarks || null,
        status: "DRAFT",
        createdBy: user!.id,
        preparedByName: data.preparedByName.trim(),
        qrToken: generateQrToken(),
        items: {
          create: lineData,
        },
      },
    });

    await tx.statusHistory.create({
      data: { dcId: dc.id, toStatus: "DRAFT", changedBy: user!.id, reason: "DC created" },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "DC_CREATED",
      module: "DeliveryChallans",
      entityType: "DeliveryChallan",
      entityId: dc.id,
      newValue: {
        dcNumber,
        vendorId: data.vendorId,
        woNumber: data.woNumber,
        partNumber: data.partNumber.trim(),
        expectedScrap: data.expectedScrap,
        preparedByName: data.preparedByName.trim(),
        lineCount: lineData.length,
        totalInputWeight: lineData.reduce((s, l) => s + l.inputWeight, 0),
      },
      reason: "DC created as DRAFT",
    });

    return { dcId: dc.id, dcNumber };
  });

  revalidatePath("/dcs");
  return { ok: true, ...result };
}

export async function submitForApproval(dcId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_CREATE);
  } catch {
    return { ok: false, error: "Not permitted." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  assertVendorScope(user!, dc.vendorId);
  if (dc.status !== "DRAFT") return { ok: false, error: `Cannot submit a DC in status ${dc.status}.` };

  await prisma.$transaction(async (tx) => {
    await tx.deliveryChallan.update({ where: { id: dcId }, data: { status: "PENDING_APPROVAL" } });
    await tx.statusHistory.create({ data: { dcId, fromStatus: "DRAFT", toStatus: "PENDING_APPROVAL", changedBy: user!.id } });
    await writeAudit(tx, { userId: user!.id, action: "DC_SUBMITTED", module: "DeliveryChallans", entityType: "DeliveryChallan", entityId: dcId, reason: "Submitted for approval" });
    await notifyUsersWithPermission(
      tx,
      PERMISSIONS.DC_APPROVE,
      {
        type: "DC_APPROVAL_REQUIRED",
        title: `${dc.dcNumber} needs approval`,
        body: "Submitted and waiting for approval before dispatch.",
        entityType: "DeliveryChallan",
        entityId: dcId,
      },
      user!.id,
    );
  });

  revalidatePath(`/dcs/${dcId}`);
  return { ok: true, dcId, dcNumber: dc.dcNumber };
}

const dispatchSchema = z.object({
  vehicleNumber: z.string().max(20).optional(),
  transporter: z.string().max(120).optional(),
});

export type DispatchInput = z.infer<typeof dispatchSchema>;

export async function dispatchDc(dcId: string, input: DispatchInput = {}): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_DISPATCH);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to dispatch DCs." };
    throw e;
  }

  const parsed = dispatchSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const dc = await prisma.deliveryChallan.findUnique({
    where: { id: dcId },
    include: { items: true, dispatch: true },
  });
  if (!dc) return { ok: false, error: "DC not found." };
  assertVendorScope(user!, dc.vendorId);

  if (dc.status !== "APPROVED") {
    return { ok: false, error: `Only an APPROVED DC can be dispatched (current: ${dc.status}).` };
  }
  if (dc.dispatch) {
    return { ok: false, error: "This DC has already been dispatched." };
  }
  if (dc.items.length === 0) {
    return { ok: false, error: "DC has no line items." };
  }
  const invalidLine = dc.items.some((it) => Number(it.quantity) <= 0 || Number(it.inputWeight) <= 0);
  if (invalidLine) {
    return { ok: false, error: "One or more DC lines have an invalid quantity or weight." };
  }

  const totalInputWeight = dc.items.reduce((sum, it) => sum + Number(it.inputWeight), 0);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.dispatch.create({
      data: {
        dcId,
        dispatchedAt: now,
        dispatchedBy: user!.id,
        vehicleNumber: data.vehicleNumber || null,
        transporter: data.transporter || null,
        totalInputWeight,
        items: {
          create: dc.items.map((it) => ({
            itemId: it.itemId,
            quantity: it.quantity,
            weight: it.inputWeight,
          })),
        },
      },
    });

    await tx.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "DISPATCHED",
        dispatchedBy: user!.id,
        dispatchedAt: now,
        vehicleNumber: data.vehicleNumber || null,
        transporter: data.transporter || null,
      },
    });

    await tx.statusHistory.create({
      data: { dcId, fromStatus: "APPROVED", toStatus: "DISPATCHED", changedBy: user!.id },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "DC_DISPATCHED",
      module: "DeliveryChallans",
      entityType: "DeliveryChallan",
      entityId: dcId,
      newValue: { vehicleNumber: data.vehicleNumber ?? null, transporter: data.transporter ?? null, totalInputWeight },
      reason: "DC dispatched - material-out transaction created",
    });
  });

  revalidatePath(`/dcs/${dcId}`);
  return { ok: true, dcId, dcNumber: dc.dcNumber };
}

export async function approveDc(dcId: string, approvedByName?: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_APPROVE);
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to approve DCs." };
    return { ok: false, error: "Not permitted." };
  }

  const trimmedName = (approvedByName || "").trim();
  if (!trimmedName) {
    return { ok: false, error: "Approved By Name is required.", fieldErrors: { approvedByName: "Please enter the name to appear on the DC." } };
  }
  if (trimmedName.length > 100) {
    return { ok: false, error: "Approved By Name cannot exceed 100 characters." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  assertVendorScope(user!, dc.vendorId);
  if (dc.status !== "PENDING_APPROVAL") {
    return { ok: false, error: `Only a DC pending approval can be approved (current: ${dc.status}).` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliveryChallan.update({
      where: { id: dcId },
      data: {
        status: "APPROVED",
        approvedBy: user!.id,
        approvedByName: trimmedName,
        approvedAt: new Date(),
      },
    });
    await tx.statusHistory.create({ data: { dcId, fromStatus: "PENDING_APPROVAL", toStatus: "APPROVED", changedBy: user!.id } });
    await writeAudit(tx, {
      userId: user!.id,
      action: "DC_APPROVED",
      module: "DeliveryChallans",
      entityType: "DeliveryChallan",
      entityId: dcId,
      newValue: { approvedByName: trimmedName, approvedBy: user!.id },
      reason: "DC approved",
    });
  });

  revalidatePath(`/dcs/${dcId}`);
  return { ok: true, dcId, dcNumber: dc.dcNumber };
}

const updateTransportSchema = z.object({
  vehicleNumber: z.string().max(30).optional(),
  transporter: z.string().max(120).optional(),
  ewayBillNumber: z.string().max(60).optional(),
  eSugamNumber: z.string().max(60).optional(),
});

export type UpdateTransportInput = z.infer<typeof updateTransportSchema>;

export async function updateDcTransportDetails(dcId: string, input: UpdateTransportInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to edit DCs." };
    throw e;
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  assertVendorScope(user!, dc.vendorId);

  const parsed = updateTransportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid transport or e-Way/e-Sugam data." };
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.deliveryChallan.update({
      where: { id: dcId },
      data: {
        vehicleNumber: data.vehicleNumber || null,
        transporter: data.transporter || null,
        ewayBillNumber: data.ewayBillNumber || null,
        eSugamNumber: data.eSugamNumber || null,
      },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "DC_EDITED",
      module: "DeliveryChallans",
      entityType: "DeliveryChallan",
      entityId: dcId,
      oldValue: { vehicleNumber: dc.vehicleNumber, transporter: dc.transporter, ewayBillNumber: dc.ewayBillNumber, eSugamNumber: dc.eSugamNumber },
      newValue: { vehicleNumber: data.vehicleNumber, transporter: data.transporter, ewayBillNumber: data.ewayBillNumber, eSugamNumber: data.eSugamNumber },
      reason: "Transport and e-Way Bill / e-Sugam details updated",
    });
  });

  revalidatePath(`/dcs/${dcId}`);
  return { ok: true, dcId, dcNumber: dc.dcNumber };
}