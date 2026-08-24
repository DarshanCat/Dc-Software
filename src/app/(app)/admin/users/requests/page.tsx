import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { RequestTable } from "./request-table";
import { ArrowLeft, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminRegistrationRequestsPage() {
  const sessionUser = await getSessionUser();
  const canManage = sessionUser ? await hasPermission(sessionUser.id, PERMISSIONS.USER_MANAGE) : false;

  if (!canManage) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600 bg-white">
        You do not have permission to view or manage user registration requests.
      </div>
    );
  }

  const [requests, roles] = await Promise.all([
    prisma.registrationRequest.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({
      select: { key: true, name: true },
      orderBy: { key: "asc" },
    }),
  ]);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Link href="/admin/users" className="hover:text-slate-800 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> User Administration
            </Link>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-blue-600" />
            Registration Requests
          </h1>
          <p className="text-sm text-slate-500">
            Review, approve, or reject user self-registration requests. {pendingCount} request(s) awaiting approval.
          </p>
        </div>
      </div>

      <RequestTable requests={requests} roles={roles} />
    </div>
  );
}
