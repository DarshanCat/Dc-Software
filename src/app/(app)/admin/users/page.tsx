import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { CreateUserForm } from "./create-user-form";
import { ToggleActiveButton } from "./toggle-active-button";
import { EditUserRolesDialog } from "./edit-user-roles-dialog";
import { AdminResetPasswordDialog } from "@/components/users/admin-reset-password-dialog";
import { UserCheck, UserPlus, Search, Filter } from "lucide-react";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  role?: string;
}

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const selectedRole = (sp.role ?? "").trim();
  const sessionUser = await getSessionUser();
  const canManage = sessionUser ? await hasPermission(sessionUser.id, PERMISSIONS.USER_MANAGE) : false;

  if (!canManage) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600 bg-white">
        You do not have permission to manage users.
      </div>
    );
  }

  const whereClause: Record<string, any> = {};
  if (q) {
    whereClause.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
    ];
  }
  if (selectedRole) {
    whereClause.roles = {
      some: {
        role: {
          key: selectedRole,
        },
      },
    };
  }

  const [users, roles, vendors, pendingRegistrationCount] = await Promise.all([
    prisma.user.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: { roles: { include: { role: true } }, vendor: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({ orderBy: { key: "asc" } }),
    prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" } }),
    prisma.registrationRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500">{users.length} user(s) matching current filters</p>
        </div>

        <Link
          href="/admin/users/requests"
          className="inline-flex items-center gap-2 h-9 px-4 py-2 text-sm font-medium rounded-md bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 shadow-sm"
        >
          <UserCheck className="h-4 w-4 text-blue-600" />
          <span>Registration Requests</span>
          {pendingRegistrationCount > 0 && (
            <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white font-bold">
              {pendingRegistrationCount}
            </span>
          )}
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <form method="GET" className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search users by name, email..."
            className="h-9 w-full pl-9 pr-3 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            name="role"
            defaultValue={selectedRole}
            className="h-9 w-full sm:w-44 text-sm rounded-md border border-slate-300 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name} ({r.key})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 px-3 text-xs font-medium rounded-md bg-slate-900 hover:bg-slate-800 text-white"
          >
            Filter
          </button>
        </div>
      </form>

      {pendingRegistrationCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Pending Registrations: {pendingRegistrationCount}
              </h3>
              <p className="text-xs text-amber-700">
                New user self-registration request(s) awaiting administrator approval and role assignment.
              </p>
            </div>
          </div>
          <Link
            href="/admin/users/requests"
            className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md bg-amber-800 hover:bg-amber-900 text-white"
          >
            Review Requests
          </Link>
        </div>
      )}

      {/* User Management Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Created Date</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-slate-500">
                  No users found matching your search or role filter.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const roleKeys = u.roles.map((ur) => ur.role.key);
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-900 font-medium">{u.name}</td>
                    <td className="px-3 py-2 text-slate-600">{u.email}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {roleKeys.map((k) => (
                          <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {k}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          u.active
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                            : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                        }
                      >
                        {u.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <EditUserRolesDialog
                          userId={u.id}
                          userName={u.name}
                          currentRoleKeys={roleKeys}
                          allRoles={roles.map((r) => ({ key: r.key, name: r.name }))}
                        />
                        <ToggleActiveButton userId={u.id} active={u.active} isSelf={u.id === sessionUser!.id} />
                        <AdminResetPasswordDialog userId={u.id} userName={u.name} userEmail={u.email} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Add User (Direct Admin Provisioning)</h2>
        <CreateUserForm
          roles={roles.map((r) => ({ key: r.key, name: r.name }))}
          vendors={vendors.map((v) => ({ id: v.id, name: v.vendorName }))}
        />
      </div>
    </div>
  );
}