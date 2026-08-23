import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import type { DcStatus } from "@prisma/client";

const TERMINAL_STATUSES: DcStatus[] = ["CLOSED", "CANCELLED"];
const BUCKET_ORDER = ["0-7 Days", "8-15 Days", "16-30 Days", "31-60 Days", "60+ Days"];

function ageingBucket(days: number): string {
  if (days <= 7) return "0-7 Days";
  if (days <= 15) return "8-15 Days";
  if (days <= 30) return "16-30 Days";
  if (days <= 60) return "31-60 Days";
  return "60+ Days";
}

interface SearchParams {
  basis?: string;
}

export default async function AgeingReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.REPORT_VIEW) : false;

  if (!canView) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to view reports.
      </div>
    );
  }

  const basis = sp.basis === "overdue" ? "overdue" : "dispatch";
  const now = new Date();

  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { notIn: TERMINAL_STATUSES } },
    include: { vendor: true, dispatch: true },
    orderBy: { dcDate: "desc" },
  });

  interface Row {
    dcId: string;
    dcNumber: string;
    vendorName: string;
    status: string;
    referenceDate: Date;
    days: number;
    bucket: string;
  }

  const rows: Row[] = [];
  for (const dc of dcs) {
    if (basis === "dispatch") {
      if (!dc.dispatch) continue;
      const days = Math.floor((now.getTime() - dc.dispatch.dispatchedAt.getTime()) / (1000 * 60 * 60 * 24));
      rows.push({
        dcId: dc.id, dcNumber: dc.dcNumber, vendorName: dc.vendor.vendorName, status: dc.status,
        referenceDate: dc.dispatch.dispatchedAt, days, bucket: ageingBucket(days),
      });
    } else {
      if (!dc.expectedReturnDate || dc.expectedReturnDate >= now) continue;
      const days = Math.floor((now.getTime() - dc.expectedReturnDate.getTime()) / (1000 * 60 * 60 * 24));
      rows.push({
        dcId: dc.id, dcNumber: dc.dcNumber, vendorName: dc.vendor.vendorName, status: dc.status,
        referenceDate: dc.expectedReturnDate, days, bucket: ageingBucket(days),
      });
    }
  }
  rows.sort((a, b) => b.days - a.days);

  const bucketCounts = new Map<string, number>();
  for (const r of rows) bucketCounts.set(r.bucket, (bucketCounts.get(r.bucket) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Ageing</h1>
          <p className="text-sm text-slate-500">
            {basis === "dispatch"
              ? "Days since dispatch, for all material currently outside the building."
              : "Days overdue against expected return date."}
          </p>
        </div>
        <a href={"/reports/ageing/export?basis=" + basis} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Export CSV
        </a>
      </div>

      <div className="flex gap-2">
        <Link
          href="/reports/ageing?basis=dispatch"
          className={
            basis === "dispatch"
              ? "rounded-full bg-slate-900 px-3 py-1 text-xs text-white"
              : "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          }
        >
          Since Dispatch
        </Link>
        <Link
          href="/reports/ageing?basis=overdue"
          className={
            basis === "overdue"
              ? "rounded-full bg-slate-900 px-3 py-1 text-xs text-white"
              : "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          }
        >
          Overdue Only
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BUCKET_ORDER.map((b) => (
          <div key={b} className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-xs font-medium uppercase text-slate-500">{b}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{bucketCounts.get(b) ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC No</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">{basis === "dispatch" ? "Dispatched On" : "Expected Return"}</th>
              <th className="px-3 py-2 text-right font-medium">Days</th>
              <th className="px-3 py-2 font-medium">Bucket</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  {basis === "dispatch" ? "No dispatched DCs currently outstanding." : "No overdue DCs right now."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.dcId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={"/dcs/" + r.dcId} className="font-mono text-blue-700 hover:underline">
                      {r.dcNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-900">{r.vendorName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.referenceDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.days}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.bucket === "60+ Days"
                          ? "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
                          : r.bucket === "31-60 Days"
                            ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                            : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      }
                    >
                      {r.bucket}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.status.replace(/_/g, " ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
