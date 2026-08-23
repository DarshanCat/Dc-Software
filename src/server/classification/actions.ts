"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { computeClassification } from "@/services/classification.service";
import { z } from "zod";

const classificationLineSchema = z.object({
  itemId: z.string().min(1),
  receivedQty: z.coerce.number().min(0),
  goodQty: z.coerce.number().min(0),
  scrapQty: z.coerce.number().min(0),
  scrapTypeId: z.string().optional(),
});

const classificationSchema = z.object({
  dcId: z.string().min(1),
  materialReceiptId: z.string().optional(),
  lines: z.array(classificationLineSchema).min(1, "At least one line is required"),
});

export type ClassificationInput = z.infer<typeof classificationSchema>;

export type ActionResult =
  | { ok: true; classificationId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Internal classification of returned material into Good / Scrap (spec §8–§10).
 * NOT a vendor-rejection concept — this happens strictly after our own team
 * receives and inspects the material. Unclassified is derived, never stored.
 */
export async function createClassification(input: ClassificationInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    // Interim: reuse RECEIPT_EDIT (Quality/Stores already hold this) for
    // classification authority; a dedicated CLASSIFICATION_CREATE can follow.
    await requirePermission(user, PERMISSIONS.RECEIPT_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to classify material." };
    throw e;
  }

  const parsed = classificationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields." };
  }
  const data = parsed.data;

  // Validate each line server-side against the tested classification engine —
  // reject over-classification (good + scrap > received) before writing anything.
  for (const line of data.lines) {
    const result = computeClassification({
      receivedQty: line.receivedQty,
      goodQty: line.goodQty,
      scrapQty: line.scrapQty,
    });
    if (result.overClassified) {
      return {
        ok: false,
        error: `Good + Scrap cannot exceed Received quantity for one of the lines.`,
      };
    }
    if (line.scrapQty > 0 && !line.scrapTypeId) {
      return { ok: false, error: "Scrap Type is required when Scrap quantity is greater than 0." };
    }
  }

  const dc = await prisma.deliveryChallan.findUnique({ where: { id: data.dcId } });
  if (!dc) return { ok: false, error: "DC not found." };

  const result = await prisma.$transaction(async (tx) => {
    const classification = await tx.materialClassification.create({
      data: {
        dcId: data.dcId,
        materialReceiptId: data.materialReceiptId || null,
        classifiedBy: user!.id,
        items: {
          create: data.lines.map((l) => ({
            itemId: l.itemId,
            receivedQty: l.receivedQty,
            goodQty: l.goodQty,
            scrapQty: l.scrapQty,
            scrapTypeId: l.scrapQty > 0 ? l.scrapTypeId || null : null,
          })),
        },
      },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "MATERIAL_CLASSIFIED",
      module: "Classification",
      entityType: "MaterialClassification",
      entityId: classification.id,
      newValue: { dcId: data.dcId, lines: data.lines },
      reason: "Material internally classified as Good/Scrap",
    });

    return { classificationId: classification.id };
  });

  revalidatePath(`/dcs/${data.dcId}`);
  return { ok: true, ...result };
}