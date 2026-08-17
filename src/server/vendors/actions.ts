"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { vendorSchema, type VendorInput } from "@/lib/validation/vendor";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createVendor(input: VendorInput): Promise<ActionResult> {
  const user = await getSessionUser();

  // Server-side authorization — the real gate (not UI hiding).
  try {
    await requirePermission(user, PERMISSIONS.VENDOR_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to create vendors." };
    throw e;
  }

  // Server-side validation — never trust the client.
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  // Enforce unique vendor code (spec §10).
  const existing = await prisma.vendor.findUnique({ where: { vendorCode: data.vendorCode } });
  if (existing) {
    return { ok: false, error: "Vendor code already exists.", fieldErrors: { vendorCode: "Already in use." } };
  }

  await prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({
      data: {
        vendorCode: data.vendorCode,
        vendorName: data.vendorName,
        gstNumber: data.gstNumber || null,
        city: data.city || null,
        state: data.state || null,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        defaultReturnDays: data.defaultReturnDays,
      },
    });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CHANGED",
      module: "Vendors",
      entityType: "Vendor",
      entityId: vendor.id,
      newValue: { vendorCode: vendor.vendorCode, vendorName: vendor.vendorName },
      reason: "Vendor created",
    });
  });

  revalidatePath("/masters/vendors");
  return { ok: true };
}