import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { PricingMasterClient } from "./pricing-master-client";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getSessionUser();
  const canEdit = user ? await hasPermission(user.id, PERMISSIONS.ITEM_EDIT) : false;
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.ITEM_CREATE) : false;

  const [jobWorkPricings, items, vendors, processes] = await Promise.all([
    prisma.jobWorkPricing.findMany({
      include: {
        vendor: { select: { id: true, vendorName: true, vendorCode: true } },
        process: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ vendor: { vendorName: "asc" } }, { partNumber: "asc" }],
    }),
    prisma.itemMaster.findMany({
      where: { active: true },
      orderBy: { partNumber: "asc" },
    }),
    prisma.vendor.findMany({
      where: { active: true },
      select: { id: true, vendorName: true, vendorCode: true },
      orderBy: { vendorName: "asc" },
    }),
    prisma.process.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const formattedJobWorkPricings = jobWorkPricings.map((p) => ({
    id: p.id,
    vendorId: p.vendorId || "",
    vendorName: p.vendor?.vendorName || "Unknown Vendor",
    vendorCode: p.vendor?.vendorCode || "—",
    processId: p.processId,
    processName: p.process?.name || "Job Work Standard",
    processCode: p.process?.code || "—",
    partNumber: p.partNumber,
    uom: p.uom,
    rate: Number(p.rate),
    notes: p.notes,
    active: p.active,
    createdAt: p.createdAt.toLocaleDateString(),
  }));

  const formattedItems = items.map((i) => ({
    id: i.id,
    partNumber: i.partNumber,
    partDescription: i.partDescription,
    pricingBasis: i.pricingBasis as "RW" | "FG",
    ratePerQuantity: i.ratePerQuantity ? Number(i.ratePerQuantity) : null,
    uom: i.uom,
    active: i.active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Job Work Pricing Master</h1>
        <p className="text-sm text-slate-500">
          Maintain standard vendor job work rates (in ₹) and part-level pricing rules for automated Delivery Challan calculations
        </p>
      </div>
      <PricingMasterClient
        jobWorkPricings={formattedJobWorkPricings}
        items={formattedItems}
        vendors={vendors}
        processes={processes}
        canEdit={canEdit}
        canCreate={canCreate}
      />
    </div>
  );
}
