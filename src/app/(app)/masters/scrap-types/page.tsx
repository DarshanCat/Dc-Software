import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { ScrapTypeMasterClient } from "./scrap-type-master-client";

export const dynamic = "force-dynamic";

export default async function ScrapTypesPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.SCRAP_CREATE) : false;
  const canEdit = user ? await hasPermission(user.id, PERMISSIONS.SCRAP_EDIT) : false;

  const scrapTypes = await prisma.scrapType.findMany({ orderBy: { name: "asc" } });

  const formattedScrapTypes = scrapTypes.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    description: s.description,
    unit: s.unit,
    active: s.active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Scrap Types Master</h1>
        <p className="text-sm text-slate-500">{scrapTypes.length} scrap type(s) configured</p>
      </div>
      <ScrapTypeMasterClient scrapTypes={formattedScrapTypes} canCreate={canCreate} canEdit={canEdit} />
    </div>
  );
}
