import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { ManagerApprovalForm } from "./manager-form";

export const dynamic = "force-dynamic";

export default async function ManagerApprovalPage() {
  await requireUser();

  const dcs = await prisma.deliveryChallan.findMany({
    where: {
      status: { in: ["MANAGER_APPROVAL_PENDING", "QUALITY_COMPLETED", "STORE_VERIFIED", "FINAL_APPROVED"] },
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
    actualInwardQty: Number(dc.actualInwardQty ?? dc.storeReceivedQty ?? 0),
    storeReceivedQty: Number(dc.storeReceivedQty ?? 0),
    goodQty: Number(dc.goodQty ?? dc.finalApprovedFgQuantity ?? 0),
    rejectionQty: Number(dc.rejectionQty ?? dc.finalApprovedRejectionQuantity ?? 0),
    scrapQty: Number(dc.scrapQty ?? dc.finalApprovedScrapQuantity ?? 0),
    qualityDecision: dc.qualityDecision || "PASSED",
    inspectionRemarks: dc.inspectionRemarks || "None",
    status: dc.status,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Manager Approval Portal</h1>
        <p className="text-sm text-slate-500">
          Review full DC lifecycle details and complete Quality results before authorizing payment and closure.
        </p>
      </div>

      <ManagerApprovalForm dcs={dcsFormatted} />
    </div>
  );
}
