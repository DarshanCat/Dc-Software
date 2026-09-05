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
  try {
    await requirePermission(user, PERMISSIONS.VENDOR_CREATE);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to create vendors." };
    throw e;
  }

  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

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
        active: true,
      },
    });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_CREATED",
      module: "Vendors",
      entityType: "Vendor",
      entityId: vendor.id,
      newValue: { vendorCode: vendor.vendorCode, vendorName: vendor.vendorName },
      reason: "Vendor created",
    });
  });

  revalidatePath("/masters/suppliers");
  revalidatePath("/masters/vendors");
  return { ok: true };
}

export async function updateVendor(id: string, input: VendorInput): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.VENDOR_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to edit vendors." };
    throw e;
  }

  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Vendor not found." };

  if (data.vendorCode !== existing.vendorCode) {
    const duplicate = await prisma.vendor.findUnique({ where: { vendorCode: data.vendorCode } });
    if (duplicate) return { ok: false, error: "Vendor code already exists." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.vendor.update({
      where: { id },
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
      action: "MASTER_UPDATED",
      module: "Vendors",
      entityType: "Vendor",
      entityId: id,
      oldValue: { vendorCode: existing.vendorCode, vendorName: existing.vendorName },
      newValue: { vendorCode: updated.vendorCode, vendorName: updated.vendorName },
      reason: "Vendor updated",
    });
  });

  revalidatePath("/masters/suppliers");
  revalidatePath("/masters/vendors");
  return { ok: true };
}

export async function toggleVendorActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.VENDOR_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to modify vendors." };
    throw e;
  }

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Vendor not found." };

  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({ where: { id }, data: { active } });
    await writeAudit(tx, {
      userId: user!.id,
      action: active ? "MASTER_REACTIVATED" : "MASTER_DEACTIVATED",
      module: "Vendors",
      entityType: "Vendor",
      entityId: id,
      oldValue: { active: existing.active },
      newValue: { active },
      reason: active ? "Vendor reactivated" : "Vendor deactivated",
    });
  });

  revalidatePath("/masters/suppliers");
  revalidatePath("/masters/vendors");
  return { ok: true };
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  try {
    await requirePermission(user, PERMISSIONS.VENDOR_EDIT);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to delete vendors." };
    throw e;
  }

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Vendor not found." };

  // Check foreign key dependencies
  const [dcCount, woCount] = await Promise.all([
    prisma.deliveryChallan.count({ where: { vendorId: id } }),
    prisma.workOrder.count({ where: { vendorId: id } }),
  ]);

  if (dcCount + woCount > 0) {
    return {
      ok: false,
      error: "This vendor cannot be deleted because it is already used in existing DC records. Deactivate it instead.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendor.delete({ where: { id } });
    await writeAudit(tx, {
      userId: user!.id,
      action: "MASTER_DELETED",
      module: "Vendors",
      entityType: "Vendor",
      entityId: id,
      oldValue: { vendorCode: existing.vendorCode, vendorName: existing.vendorName },
      reason: "Unused vendor deleted",
    });
  });

  revalidatePath("/masters/suppliers");
  revalidatePath("/masters/vendors");
  return { ok: true };
}