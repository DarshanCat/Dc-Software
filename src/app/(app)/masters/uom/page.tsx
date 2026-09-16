import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { UOMMasterClient } from "./uom-master-client";

export const dynamic = "force-dynamic";

export default async function UomPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.UOM_CREATE) : false;
  const canEdit = user ? await hasPermission(user.id, PERMISSIONS.UOM_EDIT) : false;

  const uoms = await prisma.uOM.findMany({ orderBy: { code: "asc" } });

  const formattedUoms = uoms.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name,
    isWeight: u.isWeight,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Units of Measure</h1>
        <p className="text-sm text-slate-500">{uoms.length} UOM(s) configured</p>
      </div>
      <UOMMasterClient uoms={formattedUoms} canCreate={canCreate} canEdit={canEdit} />
    </div>
  );
}