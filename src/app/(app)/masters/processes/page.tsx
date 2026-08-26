import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { ProcessMasterClient } from "./process-master-client";

export const dynamic = "force-dynamic";

export default async function ProcessesPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.PROCESS_CREATE) : false;
  const canEdit = user ? await hasPermission(user.id, PERMISSIONS.PROCESS_EDIT) : false;

  const processes = await prisma.process.findMany({
    orderBy: { name: "asc" },
  });

  const formattedProcesses = processes.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    active: p.active,
    createdAt: p.createdAt.toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Process Master</h1>
        <p className="text-sm text-slate-500">{processes.length} process(es) registered</p>
      </div>
      <ProcessMasterClient processes={formattedProcesses} canCreate={canCreate} canEdit={canEdit} />
    </div>
  );
}