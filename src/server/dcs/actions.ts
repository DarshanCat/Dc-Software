"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { computeExpected } from "@/services/reconciliation.service";
import { generateQrToken } from "@/services/dispatch.service";
import { z } from "zod";
import { notifyUsersWithPermission, createNotification } from "@/server/notifications/service";

const createDcSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  processId: z.string().min(1, "Process is required"),
  itemId: z.string().min(1, "Item is required"),
  purpose: z.enum([
    "JOB_WORK","MACHINING","HEAT_TREATMENT","SURFACE_TREATMENT",
    "REPAIR","SAMPLE","TRIAL","SUBCONTRACTING","OTHER",
  ]),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  inputWeight: z.coerce.number().positive("Input weight must be > 0"),
  expectedReturnDate: z.string().optional(),
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

  const standard = await prisma.jobWorkStandard.findFirst({
    where: { itemId: data.itemId, processId: data.processId, approved: true },
    orderBy: { revision: "desc" },
  });

    const expected = standard
    ? computeExpected(
        {
          inputWeight: data.inputWeight,
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
        expectedFinishedWeight: data.inputWeight.toFixed(3),
        expectedScrapWeight: "0.000",
        allowedProcessLoss: "0.000",
        expectedAccounted: data.inputWeight.toFixed(3),
        balances: true,
      };

  const now = new Date();
  const fy = fiscalYearOf(now);

  const result = await prisma.$transaction(async (tx) => {
    const dcNumber = await nextNumber(tx, { key: "DC", fiscalYear: fy });

    const dc = await tx.deliveryChallan.create({
      data: {
        dcNumber,
        dcDate: now,
        vendorId: data.vendorId,
        purpose: data.purpose,
        processId: data.processId,
        expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        remarks: data.remarks || null,
        status: "DRAFT",
        createdBy: user!.id,
        items: {
          create: [
            {
              itemId: data.itemId,
              quantity: data.quantity,
              uom: "NOS",
              inputWeight: data.inputWeight,
              expectedFinishedWeight: expected.expectedFinishedWeight,
              expectedScrapWeight: expected.expectedScrapWeight,
              expectedProcessLoss: expected.allowedProcessLoss,
              tolerancePercentage: standard?.tolerancePercentage ?? 0,
              jobWorkStandardId: standard?.id ?? null,
            },
          ],
        },
      },
    });

    await tx.statusHistory.create({
      data: { dcId: dc.id, toStatus: "DRAFT", changedBy: user!.id, reason: "DC created" },
    });

        await writeAudit(tx, {
      userId: user!.id,
      action: "DC_DISPATCHED",
      module: "DeliveryChallans",
      entityType: "DeliveryChallan",
      entityId: dcId,
      newValue: { vehicleNumber: data.vehicleNumber ?? null, transporter: data.transporter ?? null, totalInputWeight },
      reason: "DC dispatched — material-out transaction created",
    });

    if (dc.createdBy && dc.createdBy !== user!.id) {
      await createNotification(tx, {
        userId: dc.createdBy,
        type: "DC_DISPATCHED",
        title: `${dc.dcNumber} has been dispatched`,
        body: "Material has left the building and is now with the vendor.",
        entityType: "DeliveryChallan",
        entityId: dcId,
      });
    }
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

/**
 * Dispatch (spec Section 20): APPROVED -> DISPATCHED. Creates an immutable material-out
 * transaction (Dispatch + DispatchItem rows are never edited afterward - corrections
 * go through the amendment flow, not a direct update). Also mints the QR token here,
 * once, since the DC becomes immutable-in-transit from this point.
 */
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
  const qrToken = generateQrToken();

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
        qrToken,
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

export async function approveDc(dcId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_APPROVE);
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to approve DCs." };
    return { ok: false, error: "Not permitted." };
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: dcId } });
  if (!dc) return { ok: false, error: "DC not found." };
  if (dc.status !== "PENDING_APPROVAL") {
    return { ok: false, error: `Only a DC pending approval can be approved (current: ${dc.status}).` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliveryChallan.update({
      where: { id: dcId },
      data: { status: "APPROVED", approvedBy: user!.id, approvedAt: new Date() },
    });
    await tx.statusHistory.create({ data: { dcId, fromStatus: "PENDING_APPROVAL", toStatus: "APPROVED", changedBy: user!.id } });
    await writeAudit(tx, { userId: user!.id, action: "DC_APPROVED", module: "DeliveryChallans", entityType: "DeliveryChallan", entityId: dcId, reason: "DC approved" });
  });

  revalidatePath(`/dcs/${dcId}`);
  return { ok: true, dcId, dcNumber: dc.dcNumber };
}