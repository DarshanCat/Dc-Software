import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import type { DcStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const RECEIVABLE_STATUSES: DcStatus[] = [
  "DISPATCHED",
  "AT_VENDOR",
  "SECURITY_RETURNED",
  "APPROVED",
  "DRAFT",
  "PARTIALLY_RETURNED",
];

export default async function NewReceiptPage() {
  await requireUser();

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
          Select a DC to record its material return. Receiving occurs directly on the DC details page.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">DC Number</th>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium text-right">Return FG Qty</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dcs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No DCs currently available for material receiving.
                </td>
              </tr>
            ) : (
              dcs.map((dc) => {
                const qty = Number(dc.returnFgQuantity ?? dc.rmQuantity ?? 0);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-slate-800 font-medium">{dc.dcNumber}</td>
                    <td className="px-4 py-2.5 text-slate-900">{dc.supplierNameSnapshot || dc.vendor?.vendorName || "INTERNAL"}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{qty}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {dc.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/dcs/${dc.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
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