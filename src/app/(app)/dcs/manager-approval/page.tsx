import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { ManagerApprovalForm } from "./manager-form";

export const dynamic = "force-dynamic";

export default async function ManagerApprovalPage() {
  await requireUser();

  const [preOutwardDcsRaw, paymentDcsRaw] = await Promise.all([
    prisma.deliveryChallan.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: { vendor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.deliveryChallan.findMany({
      where: { status: { in: ["QUALITY_COMPLETED", "MANAGER_APPROVAL_PENDING"] } },
      include: { vendor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const mapDc = (dc: typeof preOutwardDcsRaw[number]) => ({
    id: dc.id,
    dcNumber: dc.dcNumber,
    dcDate: dc.dcDate.toLocaleDateString(),
    vendorName: dc.supplierNameSnapshot || dc.vendor.vendorName,
    vendorAddress: dc.supplierAddressSnapshot || dc.vendor.address || "N/A",
    vendorGst: dc.supplierGstSnapshot || dc.vendor.gstNumber || "N/A",
    woNumber: dc.woNumber,
    partNumber: dc.partNumberSnapshot || dc.partNumber || "N/A",
    partDescription: dc.partDescriptionSnapshot || "N/A",
    department: dc.department || "PRODUCTION",
    outwardQtyRw: Number(dc.outwardQtyRw ?? dc.rmQuantity ?? 0),
    returningFgQuantity: Number(dc.returnFgQuantity ?? 0),
    outwardWeight: Number(dc.outwardWeight ?? 0),
    outwardGatingWeight: Number(dc.outwardGatingWeight ?? 0),
    outwardBoringWeight: Number(dc.outwardBoringWeight ?? 0),
    length: dc.length ? Number(dc.length) : null,
    width: dc.width ? Number(dc.width) : null,
    height: dc.height ? Number(dc.height) : null,
    pricingBasis: dc.pricingBasis || "RW",
    ratePerQuantity: Number(dc.ratePerQuantity ?? 0),
    expectedAmount: Number(dc.expectedAmount ?? dc.pricingSnapshot ?? 0),
    actualInwardQty: Number(dc.actualInwardQty ?? dc.storeReceivedQty ?? 0),
    storeReceivedQty: Number(dc.storeReceivedQty ?? 0),
    goodQty: Number(dc.goodQty ?? dc.finalApprovedFgQuantity ?? 0),
    rejectionQty: Number(dc.rejectionQty ?? dc.finalApprovedRejectionQuantity ?? 0),
    scrapQty: Number(dc.scrapQty ?? dc.finalApprovedScrapQuantity ?? 0),
    qualityDecision: dc.qualityDecision || "PASSED",
    inspectionRemarks: dc.inspectionRemarks || "None",
    status: dc.status,
  });

  const preOutwardDcs = preOutwardDcsRaw.map(mapDc);
  const paymentDcs = paymentDcsRaw.map(mapDc);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Manager Approval Portal</h1>
        <p className="text-sm text-slate-500">
          Governance portal for Pre-Outward DC Dispatch Approvals and Post-Quality Commercial Payment Approvals.
        </p>
      </div>

      <ManagerApprovalForm preOutwardDcs={preOutwardDcs} paymentDcs={paymentDcs} />
    </div>
  );
}
