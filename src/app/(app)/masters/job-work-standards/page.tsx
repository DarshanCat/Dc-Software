import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { JobWorkStandardForm } from "./job-work-standard-form";
import { ApproveStandardButton } from "./approve-standard-button";

export default async function JobWorkStandardsPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.JOB_WORK_STANDARD_CREATE) : false;
  const canApprove = user ? await hasPermission(user.id, PERMISSIONS.JOB_WORK_STANDARD_APPROVE) : false;

  const [standards, items, processes] = await Promise.all([
    prisma.jobWorkStandard.findMany({
      include: { item: true, process: true },
      orderBy: [{ itemId: "asc" }, { processId: "asc" }, { revision: "desc" }],
    }),
    prisma.item.findMany({ where: { active: true }, orderBy: { itemCode: "asc" } }),
    prisma.process.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Job Work Standards</h1>
        <p className="text-sm text-slate-500">
          {standards.length} standard(s) — expected scrap, process loss, and tolerance per item + process.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Process</th>
              <th className="px-3 py-2 font-medium">Rev</th>
              <th className="px-3 py-2 font-medium">Calc Type</th>
              <th className="px-3 py-2 text-right font-medium">Scrap %</th>
              <th className="px-3 py-2 text-right font-medium">Loss %</th>
              <th className="px-3 py-2 text-right font-medium">Tolerance %</th>
              <th className="px-3 py-2 font-medium">Effective From</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {standards.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                  No job work standards yet.
                </td>
              </tr>
            ) : (
              standards.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">{s.item.itemCode} — {s.item.itemName}</td>
                  <td className="px-3 py-2 text-slate-600">{s.process.name}</td>
                  <td className="px-3 py-2 font-mono">{s.revision}</td>
                  <td className="px-3 py-2 text-slate-600">{s.calculationType}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.expectedScrapPercentage ? Number(s.expectedScrapPercentage).toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.allowedProcessLossPercentage ? Number(s.allowedProcessLossPercentage).toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{Number(s.tolerancePercentage).toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-600">{s.effectiveFrom.toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        s.approved
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                          : "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                      }
                    >
                      {s.approved ? "Approved" : "Pending Approval"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {!s.approved && canApprove && <ApproveStandardButton id={s.id} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Add Job Work Standard</h2>
          <JobWorkStandardForm
            items={items.map((i) => ({ id: i.id, label: i.itemCode + " — " + i.itemName }))}
            processes={processes.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
      )}
    </div>
  );
}