import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { CreateUserForm } from "./create-user-form";
import { ToggleActiveButton } from "./toggle-active-button";
import { AdminResetPasswordDialog } from "@/components/users/admin-reset-password-dialog";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
}

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const sessionUser = await getSessionUser();
  const canManage = sessionUser ? await hasPermission(sessionUser.id, PERMISSIONS.USER_MANAGE) : false;

  if (!canManage) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to manage users.
      </div>
    );
  }

  const [users, roles, vendors] = await Promise.all([
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { id: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { roles: { include: { role: true } }, vendor: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({ orderBy: { key: "asc" } }),
    prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">{users.length} user(s)</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Roles</th>
              <th className="px-3 py-2 font-medium">Vendor Scope</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-900">{u.name}</td>
                <td className="px-3 py-2 text-slate-600">{u.email}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((ur) => (
                      <span key={ur.roleId} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {ur.role.key}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600">{u.vendor?.vendorName ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      u.active
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                    }
                  >
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center">
                    <ToggleActiveButton userId={u.id} active={u.active} isSelf={u.id === sessionUser!.id} />
                    <AdminResetPasswordDialog userId={u.id} userName={u.name} userEmail={u.email} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Add User</h2>
        <CreateUserForm
          roles={roles.map((r) => ({ key: r.key, name: r.name }))}
          vendors={vendors.map((v) => ({ id: v.id, name: v.vendorName }))}
        />
      </div>
    </div>
  );
}