import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { CreateDcForm } from "./create-dc-form";

export const dynamic = "force-dynamic";

export default async function NewDcPage() {
  await requireUser();
  const [vendors, processes] = await Promise.all([
    prisma.vendor.findMany({ where: { active: true }, orderBy: { vendorName: "asc" } }),
    prisma.process.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Create Delivery Challan</h1>
      <CreateDcForm
        vendors={vendors.map((v) => ({ id: v.id, name: v.vendorName }))}
        processes={processes.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}