import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { DcActions } from "./dc-actions";

export default async function DcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const dc = await prisma.deliveryChallan.findUnique({
    where: { id },
    include: { vendor: true, process: true, items: { include: { item: true } }, statusHistory: { orderBy: { createdAt: "asc" } } },
  });
  if (!dc) notFound();

  const canApprove = user ? await hasPermission(user.id, PERMISSIONS.DC_APPROVE) : false;
  const canSubmit = user ? await hasPermission(user.id, PERMISSIONS.DC_CREATE) : false;

  const totalInput = dc.items.reduce((s, it) => s + Number(it.inputWeight), 0);
  const totalFinished = dc.items.reduce((s, it) => s + Number(it.expectedFinishedWeight), 0);
  const totalScrap = dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
  const totalLoss = dc.items.reduce((s, it) => s + Number(it.expectedProcessLoss), 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-lg font-semibold text-slate-900">{dc.dcNumber}</h1>
          <p className="text-sm text-slate-500">
            {dc.vendor.vendorName} · {dc.process?.name ?? "—"} · {dc.purpose.replace(/_/g, " ")}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
          {dc.status.replace(/_/g, " ")}
        </span>
      </div>

      <DcActions
        dcId={dc.id}
        status={dc.status}
        canApprove={canApprove}
        canSubmit={canSubmit}
      />

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Expected Summary</h2>
        <div className="grid grid-cols-2 gap-1 font-mono text-sm text-slate-700">
          <span>Material Sent</span><span className="text-right">{totalInput.toFixed(3)} kg</span>
          <span>Expected Finished</span><span className="text-right">{totalFinished.toFixed(3)} kg</span>
          <span>Expected Scrap</span><span className="text-right">{totalScrap.toFixed(3)} kg</span>
          <span>Allowed Process Loss</span><span className="text-right">{totalLoss.toFixed(3)} kg</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Items</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th className="py-1">Item</th><th>Qty</th><th className="text-right">Input</th><th className="text-right">Exp. Finished</th><th className="text-right">Exp. Scrap</th></tr>
          </thead>
          <tbody>
            {dc.items.map((it) => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="py-1.5">{it.item.itemCode} — {it.item.itemName}</td>
                <td>{Number(it.quantity)}</td>
                <td className="text-right font-mono">{Number(it.inputWeight).toFixed(3)}</td>
                <td className="text-right font-mono">{Number(it.expectedFinishedWeight).toFixed(3)}</td>
                <td className="text-right font-mono">{Number(it.expectedScrapWeight).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Status History</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          {dc.statusHistory.map((h) => (
            <li key={h.id} className="font-mono">
              {h.createdAt.toLocaleString()} — {h.fromStatus ? `${h.fromStatus} → ` : ""}{h.toStatus}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}