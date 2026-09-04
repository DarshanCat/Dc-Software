import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { DepartmentMasterClient } from "./department-master-client";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.SYSTEM_SETTINGS) : false;
  const canEdit = user ? await hasPermission(user.id, PERMISSIONS.SYSTEM_SETTINGS) : false;

  let depts = await prisma.department.findMany({
    orderBy: { name: "asc" },
  });

  // Seed default departments if none exist
  if (depts.length === 0) {
    const defaults = [
      { code: "PROD", name: "PRODUCTION" },
      { code: "STORES", name: "STORES" },
      { code: "QUALITY", name: "QUALITY" },
      { code: "MAINT", name: "MAINTENANCE" },
      { code: "DISPATCH", name: "DISPATCH" },
      { code: "PURCHASE", name: "PURCHASE" },
    ];
    await prisma.department.createMany({ data: defaults, skipDuplicates: true });
    depts = await prisma.department.findMany({ orderBy: { name: "asc" } });
  }

  const formattedDepts = depts.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    active: d.active,
    createdAt: d.createdAt.toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Department Master</h1>
        <p className="text-sm text-slate-500">{depts.length} department(s) configured</p>
      </div>
      <DepartmentMasterClient departments={formattedDepts} canCreate={canCreate} canEdit={canEdit} />
    </div>
  );
}
