import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.ROLE_MANAGE) : false;

  if (!canView) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to view roles.
      </div>
    );
  }

  const roles = await prisma.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      users: true,
    },
    orderBy: { key: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Roles</h1>
        <p className="text-sm text-slate-500">
          {roles.length} role(s). Editing role-permission grants is not yet available in this UI —
          they are configured in <code className="rounded bg-slate-100 px-1">src/config/permissions.ts</code> and
          applied by the seed script.
        </p>
      </div>

      <div className="space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{role.name}</h2>
                <p className="text-xs text-slate-500">
                  {role.users.length} user(s) · {role.permissions.length} permission(s)
                  {role.isSystem && " · System role"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {role.permissions.length === 0 ? (
                <span className="text-xs text-slate-400">No permissions granted.</span>
              ) : (
                role.permissions
                  .sort((a, b) => a.permission.key.localeCompare(b.permission.key))
                  .map((rp) => (
                    <span key={rp.permissionId} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {rp.permission.key}
                    </span>
                  ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}