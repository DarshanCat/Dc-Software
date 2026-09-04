import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { QualityInspectionForm } from "./quality-form";

export const dynamic = "force-dynamic";

export default async function QualityInspectionPage() {
  await requireUser();

  const dcs = await prisma.deliveryChallan.findMany({
    where: {
      status: { in: ["QUALITY_PENDING", "STORE_CONFIRMED", "SECURITY_RETURNED", "STORE_VERIFIED"] },
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
    actualInwardQty: Number(dc.actualInwardQty ?? dc.storeReceivedQty ?? dc.securityFgQuantity ?? 0),
    storeReceivedQty: Number(dc.storeReceivedQty ?? dc.actualInwardQty ?? 0),
    status: dc.status,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Quality Inspection Portal</h1>
        <p className="text-sm text-slate-500">
          Record final material quality inspection. Good Qty + Rejection Qty + Scrap Qty must reconcile exactly with Actual Inward Qty.
        </p>
      </div>

      <QualityInspectionForm dcs={dcsFormatted} />
    </div>
  );
}
