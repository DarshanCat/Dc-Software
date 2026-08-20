import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { storage } from "@/services/storage";

const MIME_BY_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (doc.entityType === "DeliveryChallan") {
    const canView = await hasPermission(user.id, PERMISSIONS.DC_VIEW);
    if (!canView) {
      return NextResponse.json({ error: "You do not have permission to view this document." }, { status: 403 });
    }
  }

  let buffer: Buffer;
  try {
    buffer = await storage.read(doc.storageKey);
  } catch {
    return NextResponse.json({ error: "File is missing from storage." }, { status: 404 });
  }

  const mime = MIME_BY_TYPE[doc.fileType] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${doc.fileName}"`,
    },
  });
}