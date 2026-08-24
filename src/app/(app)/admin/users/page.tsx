import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { CreateUserForm } from "./create-user-form";
import { ToggleActiveButton } from "./toggle-active-button";
import { AdminResetPasswordDialog } from "@/components/users/admin-reset-password-dialog";
import { Button } from "@/components/ui/button";
import { UserCheck, UserPlus } from "lucide-react";

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
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600 bg-white">
        You do not have permission to manage users.
      </div>
    );
  }

  const [users, roles, vendors, pendingRegistrationCount] = await Promise.all([
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
    prisma.registrationRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">{users.length} active/configured user(s)</p>
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

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                <td className="px-3 py-2 text-slate-900 font-medium">{u.name}</td>
                <td className="px-3 py-2 text-slate-600">{u.email}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((ur) => (
                      <span key={ur.roleId} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
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
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
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