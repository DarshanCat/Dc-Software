import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { CreateDcForm } from "./create-dc-form";

export default async function NewDcPage() {
  await requireUser();
  const [vendors, processes, items, workOrders] = await Promise.all([
    prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" } }),
    prisma.process.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { active: true }, orderBy: { itemName: "asc" } }),
    prisma.workOrder.findMany({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      include: { vendor: true, process: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const standards = await prisma.jobWorkStandard.findMany({
    where: { approved: true },
    select: {
      itemId: true, processId: true,
      expectedScrapPercentage: true, allowedProcessLossPercentage: true,
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Create Delivery Challan</h1>
      <CreateDcForm
        workOrders={workOrders.map((w) => ({
          id: w.id,
          woNumber: w.woNumber,
          vendorId: w.vendorId,
          vendorName: w.vendor.vendorName,
          processId: w.processId ?? "",
          processName: w.process?.name ?? "",
        }))}
        vendors={vendors.map((v) => ({ id: v.id, name: v.vendorName }))}
        processes={processes.map((p) => ({ id: p.id, name: p.name }))}
        items={items.map((i) => ({ id: i.id, name: `${i.itemCode} — ${i.itemName}` }))}
        standards={standards.map((s) => ({
          itemId: s.itemId,
          processId: s.processId,
          scrapPct: Number(s.expectedScrapPercentage ?? 0),
          lossPct: Number(s.allowedProcessLossPercentage ?? 0),
        }))}
      />
    </div>
  );
}