import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { StoreReceiptForm } from "./store-receipt-form";

export const dynamic = "force-dynamic";

export default async function StoreReceiptPage() {
  await requireUser();

  const dcs = await prisma.deliveryChallan.findMany({
    where: {
      status: { in: ["INWARD_RECEIVED", "SECURITY_RETURNED"] },
    },
    include: { vendor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const dcsFormatted = dcs.map((dc) => ({
    id: dc.id,
    dcNumber: dc.dcNumber,
    vendorName: dc.supplierNameSnapshot || dc.vendor?.vendorName || "INTERNAL",
    woNumber: dc.woNumber,
    partNumber: dc.partNumber || "N/A",
    department: dc.department || "STORES",
    actualInwardQty: Number(dc.actualInwardQty ?? dc.securityFgQuantity ?? 0),
    status: dc.status,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Store Receipt Confirmation</h1>
        <p className="text-sm text-slate-500">
          Confirm physical material entry into store inventory. Store Received Qty cannot exceed Actual Inward Qty.
        </p>
      </div>

      <StoreReceiptForm dcs={dcsFormatted} />
    </div>
  );
}
