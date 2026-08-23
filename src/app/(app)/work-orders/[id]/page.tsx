import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeWoBalance } from "@/services/work-order.service";
import { computeRecovery } from "@/services/recovery.service";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  DISPATCHED: "bg-indigo-100 text-indigo-700",
  RECONCILIATION: "bg-purple-100 text-purple-700",
  RECONCILED: "bg-green-100 text-green-700",
  CLOSED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const WO_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  WAITING_FOR_MATERIAL: "bg-amber-100 text-amber-700",
  READY_FOR_PROCESSING: "bg-indigo-100 text-indigo-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  PARTIALLY_RETURNED: "bg-orange-100 text-orange-700",
  FULLY_RETURNED: "bg-green-100 text-green-700",
  CLOSED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      process: true,
      deliveryChallans: {
        orderBy: { createdAt: "asc" },
        include: {
          items: true,
          receipts: { include: { items: true } },
          recoveryReceipts: { include: { recoveryType: true } },
          recoveryRequirements: { include: { recoveryType: true } },
        },
      },
    },
  });
  if (!wo) notFound();

  const totalSentQty = wo.deliveryChallans.reduce(
    (s, dc) => s + dc.items.reduce((si, it) => si + Number(it.quantity), 0), 0);
  const totalReturnedQty = wo.deliveryChallans.reduce(
    (s, dc) => s + dc.receipts.reduce(
      (sr, r) => sr + r.items.reduce((sri, ri) => sri + Number(ri.quantityReceived), 0), 0), 0);

  const balance = computeWoBalance({
    requiredInputQty: Number(wo.requiredInputQty),
    totalSentQty,
    expectedOutputQty: Number(wo.expectedOutputQty),
    totalReturnedQty,
  });

  const recoveryByType = new Map<string, { name: string; sent: number; received: number }>();
  for (const dc of wo.deliveryChallans) {
    for (const req of dc.recoveryRequirements) {
      const key = req.recoveryTypeId;
      const entry = recoveryByType.get(key) ?? { name: req.recoveryType.name, sent: 0, received: 0 };
      entry.sent += Number(req.expectedWeight);
      recoveryByType.set(key, entry);
    }
    for (const rec of dc.recoveryReceipts) {
      const key = rec.recoveryTypeId;
      const entry = recoveryByType.get(key) ?? { name: rec.recoveryType.name, sent: 0, received: 0 };
      entry.received += Number(rec.weight);
      recoveryByType.set(key, entry);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-lg font-semibold text-slate-900">{wo.woNumber}</h1>
          <p className="text-sm text-slate-500">
            {wo.vendor.vendorName} · {wo.process?.name ?? "—"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${WO_STATUS_COLORS[balance.status] ?? "bg-slate-100 text-slate-600"}`}>
          {balance.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Work Order Summary</h2>
        <div className="grid grid-cols-2 gap-1 font-mono text-sm text-slate-700 md:grid-cols-4">
          <span className="text-slate-500">Input Required</span>
          <span className="text-right md:text-left">{balance.requiredInputQty} {wo.requiredInputUOM}</span>
          <span className="text-slate-500">Input Sent</span>
          <span className="text-right md:text-left">{balance.totalSentQty} {wo.requiredInputUOM}</span>

          <span className="text-slate-500">Input Pending</span>
          <span className="text-right md:text-left">{balance.inputPendingQty} {wo.requiredInputUOM}</span>
          <span className="text-slate-500">Input Complete</span>
          <span className="text-right md:text-left">{balance.inputComplete ? "Yes" : "No"}</span>

          <span className="text-slate-500">Expected Output</span>
          <span className="text-right md:text-left">{balance.expectedOutputQty} {wo.expectedOutputUOM}</span>
          <span className="text-slate-500">Actual Output</span>
          <span className="text-right md:text-left">{balance.totalReturnedQty} {wo.expectedOutputUOM}</span>

          <span className="text-slate-500">Output Pending</span>
          <span className="text-right md:text-left">{balance.outputPendingQty} {wo.expectedOutputUOM}</span>
          <span className="text-slate-500">Output Complete</span>
          <span className="text-right md:text-left">{balance.outputComplete ? "Yes" : "No"}</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recovery Material (WO level)</h2>
        {recoveryByType.size === 0 ? (
          <p className="text-sm text-slate-400">No recovery requirements declared on this WO's DCs.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Type</th>
                <th className="text-right">Sent</th>
                <th className="text-right">Received</th>
                <th className="text-right">Pending</th>
                <th className="text-right">Recovery %</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(recoveryByType.entries()).map(([typeId, v]) => {
                const r = computeRecovery({ sentWeight: v.sent, receivedWeight: v.received });
                return (
                  <tr key={typeId} className="border-t border-slate-100">
                    <td className="py-1.5">{v.name}</td>
                    <td className="text-right font-mono">{r.sentWeight} kg</td>
                    <td className="text-right font-mono">{r.receivedWeight} kg</td>
                    <td className="text-right font-mono">{r.pendingWeight} kg</td>
                    <td className="text-right font-mono">{r.recoveryPercent ?? "N/A"}{r.recoveryPercent ? "%" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Delivery Challans under this Work Order</h2>
        {wo.deliveryChallans.length === 0 ? (
          <p className="text-sm text-slate-400">No DCs created against this WO yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">DC No</th>
                <th className="text-right">Sent Qty</th>
                <th className="text-right">Returned Qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {wo.deliveryChallans.map((dc) => {
                const sentQty = dc.items.reduce((s, it) => s + Number(it.quantity), 0);
                const returnedQty = dc.receipts.reduce(
                  (s, r) => s + r.items.reduce((si, ri) => si + Number(ri.quantityReceived), 0), 0);
                return (
                  <tr key={dc.id} className="border-t border-slate-100">
                    <td className="py-1.5">
                      <Link href={`/dcs/${dc.id}`} className="font-mono text-blue-700 hover:underline">
                        {dc.dcNumber}
                      </Link>
                    </td>
                    <td className="text-right font-mono">{sentQty}</td>
                    <td className="text-right font-mono">{returnedQty}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[dc.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {dc.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}