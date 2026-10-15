import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountsDashboardPage() {
  const [approvedForPaymentRaw, closedDcsRaw] = await Promise.all([
    prisma.deliveryChallan.findMany({
      where: { status: "APPROVED_FOR_PAYMENT" },
      include: { vendor: true, process: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deliveryChallan.findMany({
      where: { status: "CLOSED" },
      include: { vendor: true, process: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const allDcIds = [...approvedForPaymentRaw.map((d) => d.id), ...closedDcsRaw.map((d) => d.id)];
  const documents = allDcIds.length > 0 ? await prisma.document.findMany({
    where: {
      entityType: "DeliveryChallan",
      entityId: { in: allDcIds },
    },
    orderBy: { uploadedAt: "desc" },
  }) : [];

  const invoiceDocMap = new Map<string, { id: string; fileName: string }>();
  for (const doc of documents) {
    if (!invoiceDocMap.has(doc.entityId)) {
      if (
        doc.fileName.toLowerCase().includes("invoice") ||
        doc.fileName.startsWith("Invoice_") ||
        doc.fileName.startsWith("Vendor_Invoice_")
      ) {
        invoiceDocMap.set(doc.entityId, { id: doc.id, fileName: doc.fileName });
      }
    }
  }
  for (const doc of documents) {
    if (!invoiceDocMap.has(doc.entityId)) {
      invoiceDocMap.set(doc.entityId, { id: doc.id, fileName: doc.fileName });
    }
  }

  const readyToCloseCount = approvedForPaymentRaw.filter(
    (dc) => dc.invoiceNumber && dc.invoiceDate && Number(dc.invoiceAmount) > 0 && dc.paymentReferenceNumber && dc.paymentDate,
  ).length;

  const detailsPendingCount = approvedForPaymentRaw.length - readyToCloseCount;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Accounts Financial Portal</h1>
        <p className="text-xs text-slate-500">
          Process invoice details, verify attached vendor invoices, record payment references, and explicitly close completed Delivery Challans.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">1. Payment Pending</p>
          <p className="mt-2 text-3xl font-extrabold text-blue-950">{detailsPendingCount}</p>
          <p className="mt-1 text-[11px] text-blue-700">Needs Invoice / Payment Details</p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">2. Ready to Close</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-950">{readyToCloseCount}</p>
          <p className="mt-1 text-[11px] text-emerald-700">Payment details saved — CLOSE DC enabled</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">3. Closed DCs</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{closedDcsRaw.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">Status: CLOSED</p>
        </div>
      </div>

      {/* Queue 1: Approved for Payment Queue */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="bg-blue-900 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider">Approved for Payment Queue</h2>
          <span className="rounded bg-blue-800 px-2 py-0.5 text-xs font-semibold">{approvedForPaymentRaw.length} Total</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">DC Number</th>
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Final Approved FG</th>
              <th className="px-4 py-2.5 text-right">Payable Amount</th>
              <th className="px-4 py-2.5">Vendor Invoice</th>
              <th className="px-4 py-2.5">Payment Details State</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {approvedForPaymentRaw.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400 italic">No DCs currently awaiting payment entry.</td>
              </tr>
            ) : (
              approvedForPaymentRaw.map((dc) => {
                const isReady =
                  !!dc.invoiceNumber &&
                  !!dc.invoiceDate &&
                  Number(dc.invoiceAmount) > 0 &&
                  !!dc.paymentReferenceNumber &&
                  !!dc.paymentDate;
                const invoiceDoc = invoiceDocMap.get(dc.id);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName}</td>
                    <td className="px-4 py-3 font-mono">
                      {dc.finalApprovedFgQuantity != null ? Number(dc.finalApprovedFgQuantity).toFixed(3) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {dc.finalPayableAmount != null ? `₹${Number(dc.finalPayableAmount).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-mono font-bold text-slate-900 block">
                          {dc.invoiceNumber || "—"}
                        </span>
                        {invoiceDoc ? (
                          <a
                            href={`/api/documents/${invoiceDoc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline mt-0.5"
                          >
                            <span>📄 View Invoice</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No file attached</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isReady ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900 border border-emerald-300">
                          ✓ Complete (Ready to Close)
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 border border-amber-300">
                          ⚠ Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/dcs/${dc.id}`}
                        className={`inline-block rounded px-3 py-1 text-xs font-bold text-white transition-colors ${
                          isReady ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-800 hover:bg-blue-900"
                        }`}
                      >
                        {isReady ? "Close DC" : "Enter Payment Details"}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Queue 2: Recently Closed DCs */}
      {closedDcsRaw.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="bg-slate-800 px-4 py-3 text-white flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider">Recently Closed Delivery Challans</h2>
            <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold">{closedDcsRaw.length} Closed</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">DC Number</th>
                <th className="px-4 py-2.5">Vendor</th>
                <th className="px-4 py-2.5">Invoice Number</th>
                <th className="px-4 py-2.5">Payment Ref</th>
                <th className="px-4 py-2.5 text-right">Invoice Amount</th>
                <th className="px-4 py-2.5 text-center">Attached Invoice</th>
                <th className="px-4 py-2.5 text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {closedDcsRaw.map((dc) => {
                const invoiceDoc = invoiceDocMap.get(dc.id);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{dc.dcNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{dc.vendor?.vendorName}</td>
                    <td className="px-4 py-3 font-mono">{dc.invoiceNumber || "—"}</td>
                    <td className="px-4 py-3 font-mono">{dc.paymentReferenceNumber || dc.paymentReference || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {dc.invoiceAmount != null ? `₹${Number(dc.invoiceAmount).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {invoiceDoc ? (
                        <a
                          href={`/api/documents/${invoiceDoc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          <span>📄 View Invoice</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/dcs/${dc.id}`} className="text-blue-700 hover:underline font-semibold">
                        Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
