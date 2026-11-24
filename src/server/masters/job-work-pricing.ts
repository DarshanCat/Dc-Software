"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission, ForbiddenError, UnauthenticatedError } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { writeAudit } from "@/server/audit";
import { Prisma } from "@prisma/client";

async function checkPermission(user: any, permission: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!user) return { ok: false, error: "Not signed in." };
  try {
    await requirePermission(user, permission);
    return { ok: true };
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Not signed in." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to perform this action." };
    return { ok: false, error: e instanceof Error ? e.message : "Permission denied." };
  }
}

export interface CreateJobWorkPricingInput {
  vendorId: string;
  processId: string;
  partNumber: string;
  uom: string;
  rate: number;
  notes?: string;
}

export interface UpdateJobWorkPricingInput extends CreateJobWorkPricingInput {
  id: string;
  active?: boolean;
}

export async function getJobWorkPricings() {
  const list = await prisma.jobWorkPricing.findMany({
    include: {
      vendor: { select: { id: true, vendorName: true, vendorCode: true } },
      process: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ vendor: { vendorName: "asc" } }, { partNumber: "asc" }],
  });

  return list.map((item) => ({
    id: item.id,
    vendorId: item.vendorId || "",
    vendorName: item.vendor?.vendorName || "Unknown Vendor",
    vendorCode: item.vendor?.vendorCode || "—",
    processId: item.processId,
    processName: item.process?.name || "Job Work Standard",
    processCode: item.process?.code || "—",
    partNumber: item.partNumber,
    uom: item.uom,
    rate: Number(item.rate),
    notes: item.notes,
    active: item.active,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function createJobWorkPricing(input: CreateJobWorkPricingInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.ITEM_CREATE);
  if (!permCheck.ok) return permCheck;

  const vendorId = input.vendorId?.trim();
  const processId = input.processId?.trim();
  const partNumber = (input.partNumber || "").trim().toUpperCase();
  const uom = (input.uom || "KG").trim().toUpperCase();
  const rateNum = Number(input.rate);

  if (!vendorId) return { ok: false, error: "Vendor is required." };
  if (!processId) return { ok: false, error: "Job Work Standard / Process is required." };
  if (!partNumber) return { ok: false, error: "Part Number is required." };
  if (isNaN(rateNum) || rateNum < 0) return { ok: false, error: "Rate must be a valid number >= 0." };

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return { ok: false, error: "Vendor not found." };

  const processRec = await prisma.process.findUnique({ where: { id: processId } });
  if (!processRec) return { ok: false, error: "Job Work Standard not found." };

  const existing = await prisma.jobWorkPricing.findFirst({
    where: {
      vendorId,
      processId,
      partNumber,
      active: true,
    },
  });

  if (existing) {
    return { ok: false, error: `Rate for this Vendor, Process, and Part (${partNumber}) already exists.` };
  }

  const created = await prisma.jobWorkPricing.create({
    data: {
      vendorId,
      processId,
      partNumber,
      uom,
      rate: new Prisma.Decimal(rateNum),
      notes: input.notes?.trim() || null,
      active: true,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "JOB_WORK_PRICING_CREATED",
    module: "JobWorkPricing",
    entityType: "JobWorkPricing",
    entityId: created.id,
    newValue: {
      vendor: vendor.vendorName,
      process: processRec.name,
      partNumber,
      uom,
      rate: rateNum,
    },
    reason: `Job Work Pricing created: ₹${rateNum}/${uom}`,
  });

  revalidatePath("/masters/pricing");
  revalidatePath("/dcs/new");
  revalidatePath("/dcs");
  return { ok: true, id: created.id };
}

export async function updateJobWorkPricing(input: UpdateJobWorkPricingInput) {
  const user = await getSessionUser();
  const permCheck = await checkPermission(user, PERMISSIONS.ITEM_EDIT);
  if (!permCheck.ok) return permCheck;

  if (!input.id) return { ok: false, error: "ID is required." };
  const rateNum = Number(input.rate);
  if (isNaN(rateNum) || rateNum < 0) return { ok: false, error: "Rate must be a valid number >= 0." };

  const existing = await prisma.jobWorkPricing.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "Pricing entry not found." };

  const updated = await prisma.jobWorkPricing.update({
    where: { id: input.id },
    data: {
      uom: (input.uom || existing.uom).trim().toUpperCase(),
      rate: new Prisma.Decimal(rateNum),
      notes: input.notes !== undefined ? (input.notes?.trim() || null) : existing.notes,
      active: input.active !== undefined ? input.active : existing.active,
    },
  });

  await writeAudit(prisma, {
    userId: user!.id,
    action: "JOB_WORK_PRICING_UPDATED",
    module: "JobWorkPricing",
    entityType: "JobWorkPricing",
    entityId: updated.id,
    newValue: {
      rate: rateNum,
      uom: updated.uom,
      active: updated.active,
    },
    reason: `Job Work Pricing updated: ₹${rateNum}/${updated.uom}`,
  });

  revalidatePath("/masters/pricing");
  revalidatePath("/dcs/new");
  revalidatePath("/dcs");
  return { ok: true };
}
