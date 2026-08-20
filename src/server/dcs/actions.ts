"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { nextNumber, fiscalYearOf } from "@/services/number-sequence.service";
import { computeExpected } from "@/services/reconciliation.service";
import { z } from "zod";

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
          calculationType: "PERCENTAGE",
          expectedScrapPercentage: standard.expectedScrapPercentage?.toString() ?? "0",
          allowedProcessLossPercentage: standard.allowedProcessLossPercentage?.toString() ?? "0",
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
      action: "DC_CREATED",
      module: "DeliveryChallans",
      entityType: "DeliveryChallan",
      entityId: dc.id,
      newValue: { dcNumber, vendorId: data.vendorId, inputWeight: data.inputWeight },
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
  if (dc.status !== "DRAFT") return { ok: false, error: `Cannot submit a DC in status ${dc.status}.` };

  await prisma.$transaction(async (tx) => {
    await tx.deliveryChallan.update({ where: { id: dcId }, data: { status: "PENDING_APPROVAL" } });
    await tx.statusHistory.create({ data: { dcId, fromStatus: "DRAFT", toStatus: "PENDING_APPROVAL", changedBy: user!.id } });
    await writeAudit(tx, { userId: user!.id, action: "DC_SUBMITTED", module: "DeliveryChallans", entityType: "DeliveryChallan", entityId: dcId, reason: "Submitted for approval" });
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