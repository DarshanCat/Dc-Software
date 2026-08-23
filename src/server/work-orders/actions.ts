    "use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { workOrderSchema, type WorkOrderInput } from "@/lib/validation/work-order";

export type ActionResult =
  | { ok: true; workOrderId: string; woNumber: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createWorkOrder(input: WorkOrderInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DC_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to create work orders." };
    throw e;
  }

  const parsed = workOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.workOrder.findUnique({ where: { woNumber: data.woNumber } });
  if (existing) {
    return { ok: false, error: "WO number already exists.", fieldErrors: { woNumber: "Already in use." } };
  }

  const result = await prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.create({
      data: {
        woNumber: data.woNumber,
        vendorId: data.vendorId,
        processId: data.processId || null,
        requiredInputQty: data.requiredInputQty,
        requiredInputUOM: data.requiredInputUOM || "NOS",
        expectedOutputQty: data.expectedOutputQty,
        expectedOutputUOM: data.expectedOutputUOM || "NOS",
        status: "OPEN",
        remarks: data.remarks || null,
        createdBy: user!.id,
      },
    });
    await writeAudit(tx, {
      userId: user!.id,
      action: "WO_CREATED",
      module: "WorkOrders",
      entityType: "WorkOrder",
      entityId: wo.id,
      newValue: { woNumber: wo.woNumber, requiredInputQty: data.requiredInputQty },
      reason: "Work Order created",
    });
    return { workOrderId: wo.id, woNumber: wo.woNumber };
  });

  revalidatePath("/work-orders");
  return { ok: true, ...result };
}