import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { CreateDcForm } from "./create-dc-form";

export const dynamic = "force-dynamic";

export default async function NewDcPage() {
  await requireUser();

  const [vendors, workOrders] = await Promise.all([
    prisma.vendor.findMany({
      where: { active: true },
      select: {
        id: true,
        vendorCode: true,
        vendorName: true,
        address: true,
        gstNumber: true,
        city: true,
        state: true,
      },
      orderBy: { vendorName: "asc" },
    }),
    prisma.workOrder.findMany({
      select: {
        id: true,
        woNumber: true,
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Create Outward Delivery Challan</h1>
        <p className="text-sm text-slate-500">
          Security & PPC Outgoing DC Creation form with master data auto-population and snapshot logging.
        </p>
      </div>

      <CreateDcForm vendors={vendors} items={[]} />
    </div>
  );
}