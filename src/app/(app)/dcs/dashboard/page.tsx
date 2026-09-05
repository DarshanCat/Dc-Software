import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import {
  FileText, Clock, CheckCircle2, AlertTriangle, AlertCircle,
  Truck, ArrowDownLeft, ShieldCheck, DollarSign, Archive, XCircle, PauseCircle
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DcDashboardPage() {
  await requireUser();

  const dcs = await prisma.deliveryChallan.findMany({
    include: { vendor: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const now = new Date().getTime();

  // Metrics calculation
  let draftCount = 0;
  let outwardCount = 0;
  let materialOutCount = 0;
  let inwardPendingCount = 0;
  let storePendingCount = 0;
  let qualityPendingCount = 0;
  let managerPendingCount = 0;
  let paymentPendingCount = 0;
  let closedCount = 0;
  let rejectedCount = 0;
  let holdCount = 0;

  let age0to1 = 0;
  let age2to3 = 0;
  let age4to7 = 0;
  let ageGt7 = 0;

  for (const dc of dcs) {
    const st = dc.status;
    if (st === "DRAFT") draftCount++;
    else if (st === "OUTWARD_CREATED" || st === "PENDING_APPROVAL") outwardCount++;
    else if (st === "MATERIAL_OUT" || st === "DISPATCHED" || st === "APPROVED") materialOutCount++;
    else if (st === "INWARD_PENDING" || st === "AT_VENDOR") inwardPendingCount++;
    else if (st === "INWARD_RECEIVED" || st === "SECURITY_RETURNED") storePendingCount++;
    else if (st === "QUALITY_PENDING" || st === "STORE_CONFIRMED" || st === "STORE_VERIFIED") qualityPendingCount++;
    else if (st === "MANAGER_APPROVAL_PENDING" || st === "QUALITY_COMPLETED") managerPendingCount++;
    else if (st === "PAYMENT_APPROVED" || st === "APPROVED_FOR_PAYMENT" || st === "FINAL_APPROVED") paymentPendingCount++;
    else if (st === "CLOSED") closedCount++;
    else if (st === "REJECTED" || st === "CANCELLED") rejectedCount++;
    else if (st === "HOLD" || st === "SENT_BACK") holdCount++;

    // Aging calculation (days since creation)
    const elapsedDays = Math.floor((now - new Date(dc.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (elapsedDays <= 1) age0to1++;
    else if (elapsedDays <= 3) age2to3++;
    else if (elapsedDays <= 7) age4to7++;
    else ageGt7++;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Delivery Challan Operational Dashboard</h1>
        <p className="text-sm text-slate-500">
          Factory-wide material movement metrics, lifecycle queues, aging distribution, and operational bottlenecks.
        </p>
      </div>

      {/* KPI CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Total DCs</span>
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{dcs.length}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Outward Pending</span>
            <Truck className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-900">{outwardCount}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Store Pending</span>
            <ArrowDownLeft className="h-4 w-4 text-cyan-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-cyan-900">{storePendingCount}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Quality Pending</span>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{qualityPendingCount}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Manager Review</span>
            <Clock className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-900">{managerPendingCount}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Payment Approved</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{paymentPendingCount}</p>
        </div>
      </div>

      {/* SECOND ROW: AGING & WORKFLOW STATUS DISTRIBUTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AGING DISTRIBUTION */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">DC Cycle Time Aging Distribution</h2>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="rounded-md bg-slate-50 p-3 border border-slate-200">
              <span className="text-xs text-slate-500 block font-medium">0 - 1 Days</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">{age0to1}</span>
            </div>
            <div className="rounded-md bg-blue-50 p-3 border border-blue-200">
              <span className="text-xs text-blue-700 block font-medium">2 - 3 Days</span>
              <span className="text-xl font-bold text-blue-900 mt-1 block">{age2to3}</span>
            </div>
            <div className="rounded-md bg-amber-50 p-3 border border-amber-200">
              <span className="text-xs text-amber-700 block font-medium">4 - 7 Days</span>
              <span className="text-xl font-bold text-amber-900 mt-1 block">{age4to7}</span>
            </div>
            <div className="rounded-md bg-red-50 p-3 border border-red-200">
              <span className="text-xs text-red-700 block font-medium">&gt; 7 Days (Overdue)</span>
              <span className="text-xl font-bold text-red-900 mt-1 block">{ageGt7}</span>
            </div>
          </div>
        </div>

        {/* QUICK ACTION PORTALS */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Role Operations Shortcuts</h2>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <Link href="/dcs/outward" className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800">
              <span>Outgoing DC Form</span>
              <Truck className="h-4 w-4 text-blue-600" />
            </Link>
            <Link href="/dcs/inward" className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800">
              <span>Inward DC Receipt</span>
              <ArrowDownLeft className="h-4 w-4 text-blue-600" />
            </Link>
            <Link href="/dcs/store-receipt" className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800">
              <span>Store Confirmation</span>
              <Archive className="h-4 w-4 text-blue-600" />
            </Link>
            <Link href="/dcs/quality" className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800">
              <span>Quality Inspection</span>
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </Link>
            <Link href="/dcs/manager-approval" className="flex items-center justify-between p-3 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 col-span-2">
              <span>Manager Final Approval Portal</span>
              <Clock className="h-4 w-4 text-purple-600" />
            </Link>
          </div>
        </div>
      </div>

      {/* RECENT FACTORY DCS TABLE */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Recent Factory Delivery Challans</h2>
          <Link href="/dcs" className="text-xs font-semibold text-blue-600 hover:underline">
            View All DC History →
          </Link>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
            <tr>
              <th className="px-4 py-2.5 text-left">DC Number</th>
              <th className="px-4 py-2.5 text-left">Supplier</th>
              <th className="px-4 py-2.5 text-left">WO ID</th>
              <th className="px-4 py-2.5 text-left">Department</th>
              <th className="px-4 py-2.5 text-right">Inward Qty</th>
              <th className="px-4 py-2.5 text-right">Good</th>
              <th className="px-4 py-2.5 text-right">Reject</th>
              <th className="px-4 py-2.5 text-right">Scrap</th>
              <th className="px-4 py-2.5 text-center">Status</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dcs.slice(0, 15).map((dc) => (
              <tr key={dc.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                <td className="px-4 py-2.5 text-slate-800 font-medium">
                  {dc.supplierNameSnapshot || dc.vendor?.vendorName || (dc.destinationDepartment ? `${dc.destinationDepartment} (${dc.responsibleCustodian || ''})` : "Internal Custody")}
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-700">{dc.woNumber}</td>
                <td className="px-4 py-2.5 text-slate-600">{dc.department || "PRODUCTION"}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold">{Number(dc.actualInwardQty ?? 0)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-bold">{Number(dc.goodQty ?? 0)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-red-700 font-bold">{Number(dc.rejectionQty ?? 0)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-amber-700 font-bold">{Number(dc.scrapQty ?? 0)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 font-semibold text-[10px]">
                    {dc.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/dcs/${dc.id}`} className="text-blue-600 hover:underline font-semibold">
                    Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
