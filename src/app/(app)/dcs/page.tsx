import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { filterDcDataForRole } from "@/server/dcs/sanitizer";
import { getVendorScope } from "@/server/dcs/vendor-scope";
import { Button } from "@/components/ui/button";
import { DcListRowActions } from "./dc-list-actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-300",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-blue-100 text-blue-800 border-blue-300",
  DISPATCHED: "bg-indigo-100 text-indigo-800 border-indigo-300",
  AT_VENDOR: "bg-purple-100 text-purple-800 border-purple-300",
  SECURITY_RETURNED: "bg-amber-100 text-amber-900 border-amber-400",
  STORE_VERIFIED: "bg-cyan-100 text-cyan-900 border-cyan-400",
  CUSTODIAN_VERIFIED: "bg-sky-100 text-sky-900 border-sky-400",
  QUALITY_COMPLETED: "bg-purple-100 text-purple-900 border-purple-400",
  FINAL_APPROVED: "bg-teal-100 text-teal-900 border-teal-400",
  APPROVED_FOR_PAYMENT: "bg-emerald-100 text-emerald-900 border-emerald-400",
  CLOSED: "bg-slate-200 text-slate-800 border-slate-400",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
};

const ROLE_ALLOWED_STATUSES: Record<string, string[]> = {
  SECURITY: ["DRAFT", "APPROVED", "DISPATCHED", "AT_VENDOR", "SECURITY_RETURNED"],
  STORES: ["DRAFT", "PENDING_APPROVAL", "SECURITY_RETURNED", "STORE_VERIFIED", "CUSTODIAN_VERIFIED"],
  MANAGEMENT: ["PENDING_APPROVAL", "STORE_VERIFIED", "QUALITY_COMPLETED", "FINAL_APPROVED", "APPROVED_FOR_PAYMENT", "CUSTODIAN_VERIFIED", "CLOSED"],
  ACCOUNTS: ["APPROVED_FOR_PAYMENT", "CUSTODIAN_VERIFIED", "CLOSED"],
  PRODUCTION: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
  QUALITY: ["STORE_VERIFIED", "QUALITY_COMPLETED"],
};

export default async function DcsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; overdue?: string }>;
}) {
  const { status, overdue } = await searchParams;
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.DC_CREATE) : false;
  const userRole = user?.roleKeys?.[0] || "GUEST";
  const roleKeys = user?.roleKeys || [];
  const isAdmin = roleKeys.includes("ADMIN");

  const where: Record<string, unknown> = {
    ...getVendorScope(user),
  };

  if (!isAdmin) {
    let allowed: string[] = [];
    for (const r of roleKeys) {
      if (ROLE_ALLOWED_STATUSES[r]) {
        allowed = [...allowed, ...ROLE_ALLOWED_STATUSES[r]];
      }
    }
    if (allowed.length > 0) {
      const uniqueAllowed = [...new Set(allowed)];
      if (status && uniqueAllowed.includes(status)) {
        where.status = status;
      } else {
        where.status = { in: uniqueAllowed };
      }
    }
  } else if (status) {
    where.status = status;
  }

  if (overdue === "1") {
    where.expectedReturnDate = { lt: new Date() };
    where.status = { notIn: ["CLOSED", "CANCELLED", "RECONCILED"] };
  }

  const rawDcs = await prisma.deliveryChallan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { vendor: true, process: true },
    take: 100,
  });

  // Apply server-side payload sanitization based on role
  const dcs = rawDcs.map((dc) => filterDcDataForRole(dc, userRole));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Delivery Challans</h1>
          <p className="text-xs text-slate-500">
            {dcs.length} Delivery Challan(s) found {status ? `[Filtered: ${status.replace(/_/g, " ")}]` : ""}
          </p>
        </div>
        {canCreate && (
          <Link href="/dcs/new">
            <Button className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs">Create DC</Button>
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5 font-bold">DC No</th>
              <th className="px-4 py-2.5 font-bold">Date</th>
              <th className="px-4 py-2.5 font-bold">Vendor</th>
              <th className="px-4 py-2.5 font-bold">Process</th>
              <th className="px-4 py-2.5 font-bold text-right">RM Qty</th>
              <th className="px-4 py-2.5 font-bold text-right">Exp FG Qty</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              <th className="px-4 py-2.5 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {dcs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                  No Delivery Challans found for your role or requested queue.
                </td>
              </tr>
            ) : (
              dcs.map((dc) => {
                const inputWt = Number(dc.rmQuantity ?? 0);
                const expFg = Number(dc.returnFgQuantity ?? 0);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/dcs/${dc.id}`} className="font-mono font-bold text-blue-700 hover:underline">
                        {dc.dcNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{dc.dcDate.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {dc.supplierNameSnapshot || dc.vendor?.vendorName || (dc.destinationDepartment ? `${dc.destinationDepartment} (${dc.responsibleCustodian || ''})` : "Internal Custody")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{dc.process?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">{inputWt.toFixed(3)} kg</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">{expFg.toFixed(3)} kg</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${STATUS_COLORS[dc.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {dc.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <DcListRowActions
                        dcId={dc.id}
                        dcNumber={dc.dcNumber}
                        status={dc.status}
                        canEdit={canCreate}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
