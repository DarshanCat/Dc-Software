import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { InwardDcForm } from "./inward-form";

export const dynamic = "force-dynamic";

export default async function InwardDcPage() {
  await requireUser();

  const dcs = await prisma.deliveryChallan.findMany({
    where: {
      status: { in: ["OUTWARD_CREATED", "MATERIAL_OUT", "DISPATCHED", "AT_VENDOR", "APPROVED"] },
    },
    include: { vendor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const dcsFormatted = dcs.map((dc) => ({
    id: dc.id,
    dcNumber: dc.dcNumber,
    vendorName: dc.vendor.vendorName,
    woNumber: dc.woNumber,
    partNumber: dc.partNumber || "N/A",
    department: dc.department || "PRODUCTION",
    expectedQty: Number(dc.returnFgQuantity ?? dc.rmQuantity ?? 0),
    status: dc.status,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Inward DC Gate Receipt</h1>
        <p className="text-sm text-slate-500">
          Security Gate Entry: Record physical material arrival, document numbers, invoice reference, and gate weights.
        </p>
      </div>

      <InwardDcForm dcs={dcsFormatted} />
    </div>
  );
}
