import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { JobWorkStandardsClient } from "./job-work-standards-client";

export const dynamic = "force-dynamic";

export default async function JobWorkStandardsPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.JOB_WORK_STANDARD_CREATE) : false;

  const [standards, processes] = await Promise.all([
    prisma.jobWorkStandard.findMany({
      include: { process: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.process.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const formattedStandards = standards.map((s) => ({
    id: s.id,
    processId: s.processId,
    processName: s.process.name,
    partNumber: s.partNumber,
    standardLossPercentage: Number(s.standardLossPercentage ?? 0),
    turnaroundDays: s.turnaroundDays,
    ratePerQuantity: s.ratePerQuantity ? Number(s.ratePerQuantity) : null,
    active: s.active,
    createdAt: s.createdAt.toLocaleDateString(),
  }));

  const formattedProcesses = processes.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Job Work Standards</h1>
        <p className="text-sm text-slate-500">
          Maintain process loss, turnaround lead time, and process rates per Part Number
        </p>
      </div>
      <JobWorkStandardsClient
        standards={formattedStandards}
        processes={formattedProcesses}
        canCreate={canCreate}
      />
    </div>
  );
}
