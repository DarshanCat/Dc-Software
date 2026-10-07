import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { buildDcDateRange } from "@/lib/dc-date";
import { ManagerApprovalForm } from "./manager-form";

export const dynamic = "force-dynamic";

export default async function ManagerApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ dcDateFrom?: string; dcDateTo?: string }>;
}) {
  await requireUser();

  const { dcDateFrom, dcDateTo } = await searchParams;
  const dateRange = buildDcDateRange(dcDateFrom, dcDateTo);
  // An invalid range (or From > To) must return no rows rather than silently
  // showing an unfiltered queue - never fail open on a bad date filter.
  const dcDateCondition = dateRange.error ? { gte: new Date(8640000000000000) } : dateRange.where;

  const [preOutwardDcsRaw, paymentDcsRaw] = await Promise.all([
    prisma.deliveryChallan.findMany({
      where: {
        status: "PENDING_APPROVAL",
        ...(dcDateCondition ? { dcDate: dcDateCondition } : {}),
      },
      include: { vendor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.deliveryChallan.findMany({
      where: {
        status: { in: ["QUALITY_COMPLETED", "MANAGER_APPROVAL_PENDING"] },
        ...(dcDateCondition ? { dcDate: dcDateCondition } : {}),
      },
      include: { vendor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const mapDc = (dc: typeof preOutwardDcsRaw[number]) => ({
    id: dc.id,
    dcNumber: dc.dcNumber,
    dcDate: dc.dcDate.toLocaleDateString(),
    vendorName: dc.vendor?.vendorName || dc.supplierNameSnapshot || "INTERNAL",
    vendorAddress: dc.supplierAddressSnapshot || dc.vendor?.address || "N/A",
    vendorGst: dc.vendor?.gstNumber || dc.supplierGstSnapshot || "N/A",
    woNumber: dc.woNumber,
    partNumber: dc.partNumberSnapshot || dc.partNumber || "N/A",
    partDescription: dc.partDescriptionSnapshot || "N/A",
    materialGrade: dc.materialGrade || "N/A",
    department: dc.department || "PRODUCTION",
    outwardQtyRw: Number(dc.outwardQtyRw ?? dc.rmQuantity ?? 0),
    rmUom: dc.rmUom || "NOS",
    returningFgQuantity: Number(dc.returnFgQuantity ?? 0),
    fgUom: dc.fgUom || "NOS",
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

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4" action="/dcs/manager-approval">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">DC Date From</label>
          <input
            type="date"
            name="dcDateFrom"
            defaultValue={dcDateFrom ?? ""}
            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">DC Date To</label>
          <input
            type="date"
            name="dcDateTo"
            defaultValue={dcDateTo ?? ""}
            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
          />
        </div>
        <button type="submit" className="h-9 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white">
          Search
        </button>
        <a href="/dcs/manager-approval" className="h-9 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 flex items-center">
          Clear
        </a>
        {dateRange.error && (
          <p className="w-full text-xs font-medium text-red-600">{dateRange.error} No results are shown below.</p>
        )}
      </form>

      <ManagerApprovalForm preOutwardDcs={preOutwardDcs} paymentDcs={paymentDcs} />
    </div>
  );
}
