"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { storage } from "@/services/storage";
import { validateUpload } from "@/lib/validation/document";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DOCUMENT_UPLOAD);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to upload documents." };
    throw e;
  }

  const file = formData.get("file");
  const entityType = formData.get("entityType");
  const entityId = formData.get("entityId");
  const revalidateTo = formData.get("revalidateTo");

  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  if (typeof entityType !== "string" || !entityType) return { ok: false, error: "Missing entity type." };
  if (typeof entityId !== "string" || !entityId) return { ok: false, error: "Missing entity id." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = validateUpload(buffer, file.name);
  if (!validated.ok) return { ok: false, error: validated.error };

  const storageKey = await storage.save(buffer, validated.sanitizedName);

  const result = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        entityType,
        entityId,
        fileName: validated.sanitizedName,
        fileType: validated.type,
        fileSize: buffer.length,
        storageKey,
        uploadedBy: user!.id,
      },
    });

    await writeAudit(tx, {
      userId: user!.id,
      action: "DOCUMENT_UPLOADED",
      module: "Documents",
      entityType,
      entityId,
      newValue: { fileName: validated.sanitizedName, fileType: validated.type, fileSize: buffer.length },
      reason: "Document uploaded",
    });

    return doc.id;
  });

  if (typeof revalidateTo === "string" && revalidateTo) revalidatePath(revalidateTo);
  return { ok: true, id: result };
}

export async function deleteDocument(documentId: string, revalidateTo?: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.DOCUMENT_DELETE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to delete documents." };
    throw e;
  }

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false, error: "Document not found." };

  await prisma.$transaction(async (tx) => {
    await tx.document.delete({ where: { id: documentId } });
    await writeAudit(tx, {
      userId: user!.id,
      action: "DOCUMENT_DELETED",
      module: "Documents",
      entityType: doc.entityType,
      entityId: doc.entityId,
      oldValue: { fileName: doc.fileName },
      reason: "Document deleted",
    });
  });

  await storage.delete(doc.storageKey);

  if (revalidateTo) revalidatePath(revalidateTo);
  return { ok: true, id: documentId };
}