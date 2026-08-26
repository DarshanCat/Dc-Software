import Link from "next/link";
import { prisma } from "@/lib/db";
import type { DcStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const RECEIVABLE_STATUSES: DcStatus[] = ["DRAFT", "APPROVED", "DISPATCHED", "AT_VENDOR", "PARTIALLY_RETURNED"];

export default async function NewReceiptPage() {
  const dcs = await prisma.deliveryChallan.findMany({
    where: { status: { in: RECEIVABLE_STATUSES } },
    include: { vendor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Receive Material</h1>
        <p className="text-sm text-slate-500">
          Select a DC to record its return. Receiving happens on the DC&apos;s own page.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">DC No</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium text-right">Return FG Qty</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dcs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No DCs available to receive against.</td></tr>
            ) : (
              dcs.map((dc) => {
                const qty = Number(dc.returnFgQuantity ?? 0);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-700">{dc.dcNumber}</td>
                    <td className="px-4 py-2 text-slate-900">{dc.vendor.vendorName}</td>
                    <td className="px-4 py-2 text-right font-mono">{qty}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {dc.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/dcs/${dc.id}`} className="text-sm text-blue-700 hover:underline">
                        Receive →
                      </Link>
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