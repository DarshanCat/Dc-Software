import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { ItemMasterClient } from "./item-master-client";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.ITEM_CREATE) : false;
  const canEdit = user ? await hasPermission(user.id, PERMISSIONS.ITEM_EDIT) : false;

  const items = await prisma.itemMaster.findMany({
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
    createdAt: i.createdAt.toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Part / Item Master</h1>
        <p className="text-sm text-slate-500">{items.length} master part(s) configured</p>
      </div>
      <ItemMasterClient items={formattedItems} canCreate={canCreate} canEdit={canEdit} />
    </div>
  );
}
