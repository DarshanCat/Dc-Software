import { prisma } from "@/lib/db";
import { getSessionUser, requireUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { redirect } from "next/navigation";

export default async function AuditTrailPage() {
  await requireUser();
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.AUDIT_VIEW) : false;
  if (!canView) redirect("/");

  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    include: { user: { select: { name: true, email: true } } },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Audit Trail</h1>
        <p className="text-sm text-slate-500">{logs.length} record(s) — most recent 200, append-only</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Module</th>
              <th className="px-4 py-2 font-medium">Entity</th>
              <th className="px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No audit records yet.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500">{log.timestamp.toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-700">{log.user?.name ?? "System"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-800">{log.action}</td>
                  <td className="px-4 py-2 text-slate-600">{log.module}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {log.entityType}:{log.entityId.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-2 text-slate-600">{log.reason ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}