import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { PricingMasterClient } from "./pricing-master-client";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getSessionUser();
  const canEdit = user ? await hasPermission(user.id, PERMISSIONS.ITEM_EDIT) : false;

  const items = await prisma.itemMaster.findMany({
    where: { active: true },
    orderBy: { partNumber: "asc" },
  });

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
        <h1 className="text-lg font-semibold text-slate-900">Pricing Master</h1>
        <p className="text-sm text-slate-500">
          Maintain Part rates and commercial pricing basis (RW Quantity vs Returning FG Quantity)
        </p>
      </div>
      <PricingMasterClient items={formattedItems} canEdit={canEdit} />
    </div>
  );
}
