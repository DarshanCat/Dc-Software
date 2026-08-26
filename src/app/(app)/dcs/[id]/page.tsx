import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { buildDcPublicUrl } from "@/services/dispatch.service";

export const dynamic = "force-dynamic";
import { evaluateScrap } from "@/services/scrap.service";
import { computeRecovery } from "@/services/recovery.service";
import { DcActions } from "./dc-actions";
import { ReceiveMaterialForm } from "./receive-material-form";
import { ReceiveScrapForm } from "./receive-scrap-form";
import { ReconciliationPanel } from "./reconciliation-panel";
import { DocumentsPanel } from "@/components/documents-panel";
import { AmendmentPanel } from "./amendment-panel";
import { RecoveryPanel } from "./recovery-panel";
import { ClassificationPanel } from "./classification-panel";
import { EditTransportDialog } from "./edit-transport-dialog";

export default async function DcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const dc = await prisma.deliveryChallan.findUnique({
    where: { id },
    include: {
      vendor: true,
      process: true,
      items: { include: { item: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      dispatch: true,
      receipts: { include: { items: true }, orderBy: { receiptDate: "asc" } },
      scrapReceipts: { include: { items: { include: { scrapType: true } } }, orderBy: { receiptDate: "asc" } },
      reconciliation: true,
      exceptions: { orderBy: { createdAt: "asc" } },
      recoveryRequirements: { include: { recoveryType: true } },
      recoveryReceipts: { include: { recoveryType: true }, orderBy: { receiptDate: "asc" } },
      classifications: { include: { items: { include: { scrapType: true, item: true } } }, orderBy: { classifiedAt: "asc" } },
    },
  });
  if (!dc) notFound();

  const recoveryTypes = await prisma.recoveryType.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const canReceiveRecovery = user ? await hasPermission(user.id, PERMISSIONS.SCRAP_CREATE) : false;
  const recoveryRollup = dc.recoveryRequirements.map((req) => {
    const received = dc.recoveryReceipts
      .filter((r) => r.recoveryTypeId === req.recoveryTypeId)
      .reduce((s, r) => s + Number(r.weight), 0);
    const r = computeRecovery({ sentWeight: Number(req.expectedWeight), receivedWeight: received });
    return { recoveryTypeId: req.recoveryTypeId, name: req.recoveryType.name, ...r };
  });

  const canClassify = user ? await hasPermission(user.id, PERMISSIONS.RECEIPT_EDIT) : false;
  const classifiedByItemId = new Map<string, number>();
  for (const c of dc.classifications) {
    for (const line of c.items) {
      classifiedByItemId.set(
        line.itemId,
        (classifiedByItemId.get(line.itemId) ?? 0) + Number(line.goodQty) + Number(line.scrapQty),
      );
    }
  }
  const scrapTypesForClassification = canClassify
    ? await prisma.scrapType.findMany({ where: { active: true }, orderBy: { name: "asc" } })
    : [];

  const canApprove = user ? await hasPermission(user.id, PERMISSIONS.DC_APPROVE) : false;
  const canSubmit = user ? await hasPermission(user.id, PERMISSIONS.DC_CREATE) : false;
  const canDispatch = user ? await hasPermission(user.id, PERMISSIONS.DC_DISPATCH) : false;
  const canReceive = user ? await hasPermission(user.id, PERMISSIONS.RECEIPT_CREATE) : false;
  const canScrap = user ? await hasPermission(user.id, PERMISSIONS.SCRAP_CREATE) : false;
  const canCloseDc = user ? await hasPermission(user.id, PERMISSIONS.RECONCILIATION_CLOSE) : false;
  const canOverrideException = user ? await hasPermission(user.id, PERMISSIONS.RECONCILIATION_OVERRIDE) : false;
  const canUploadDocs = user ? await hasPermission(user.id, PERMISSIONS.DOCUMENT_UPLOAD) : false;
  const canDeleteDocs = user ? await hasPermission(user.id, PERMISSIONS.DOCUMENT_DELETE) : false;
  const canRequestAmendment = user ? await hasPermission(user.id, PERMISSIONS.DC_EDIT) : false;
  const canDecideAmendment = user ? await hasPermission(user.id, PERMISSIONS.DC_APPROVE) : false;

  const qrDataUrl = dc.qrToken ? await QRCode.toDataURL(buildDcPublicUrl(dc.qrToken), { margin: 1, width: 160 }) : null;

  const documents = await prisma.document.findMany({
    where: { entityType: "DeliveryChallan", entityId: dc.id },
    orderBy: { uploadedAt: "desc" },
  });
  const uploaderIds = [...new Set(documents.map((d) => d.uploadedBy).filter((v): v is string => !!v))];
  const uploaders = uploaderIds.length
    ? await prisma.user.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, name: true } })
    : [];
  const uploaderNameById = new Map(uploaders.map((u) => [u.id, u.name]));

  const auditUserIds = [...new Set([dc.createdBy, dc.approvedBy].filter((v): v is string => !!v))];
  const auditUsers = auditUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: auditUserIds } }, select: { id: true, name: true, email: true } })
    : [];
  const auditUserMap = new Map(auditUsers.map((u) => [u.id, u.name || u.email]));

  const amendments = await prisma.dcAmendment.findMany({
    where: { dcId: dc.id },
    orderBy: { requestedAt: "desc" },
  });
  const amendmentUserIds = [
    ...new Set(
      amendments.flatMap((a) => [a.requestedBy, a.decidedBy].filter((v): v is string => !!v)),
    ),
  ];
  const amendmentUsers = amendmentUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: amendmentUserIds } }, select: { id: true, name: true } })
    : [];
  const amendmentUserNameById = new Map(amendmentUsers.map((u) => [u.id, u.name]));

  const receivedByItemId = new Map<string, number>();
  for (const receipt of dc.receipts) {
    for (const line of receipt.items) {
      receivedByItemId.set(line.itemId, (receivedByItemId.get(line.itemId) ?? 0) + Number(line.quantityReceived));
    }
  }
  const receivableStatuses = ["DRAFT", "APPROVED", "DISPATCHED", "AT_VENDOR", "PARTIALLY_RETURNED"];
  const canReceiveNow = canReceive && receivableStatuses.includes(dc.status);
  const receiveLines = dc.items.map((it) => ({
    itemId: it.itemId,
    itemCode: it.item.itemCode,
    itemName: it.item.itemName,
    sentQuantity: Number(it.quantity),
    alreadyReceived: receivedByItemId.get(it.itemId) ?? 0,
  }));

  const expectedScrapWeight = dc.expectedScrap != null ? Number(dc.expectedScrap) : dc.items.reduce((s, it) => s + Number(it.expectedScrapWeight), 0);
  const receivedScrapWeight = dc.scrapReceipts.reduce(
    (sum, r) => sum + r.items.reduce((s, l) => s + Number(l.weight), 0),
    0,
  );
  const scrapTolerance = dc.items.length > 0 ? Number(dc.items[0].tolerancePercentage) : 0;
  const scrapEval = evaluateScrap(expectedScrapWeight, receivedScrapWeight, scrapTolerance);
  const scrapReceivableStatuses = ["MATERIAL_RETURNED", "SCRAP_PENDING"];
  const canScrapNow = canScrap && scrapReceivableStatuses.includes(dc.status);
  const scrapTypes = canScrapNow
    ? await prisma.scrapType.findMany({ where: { active: true }, orderBy: { code: "asc" } })
    : [];

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
            <a href={`/work-orders?wo=${encodeURIComponent(dc.woNumber)}`} className="font-mono text-blue-700 hover:underline">
              {dc.woNumber}
            </a>
            {dc.partNumber ? ` · Part No: ${dc.partNumber}` : ""}
            {" · "}
            {dc.vendor.vendorName} · {dc.process?.name ?? "—"} · {dc.purpose.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
            {dc.status.replace(/_/g, " ")}
          </span>
          <a href={"/dcs/" + dc.id + "/pdf"} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Print / PDF</a>
        </div>
      </div>

      <DcActions
        dcId={dc.id}
        status={dc.status}
        canApprove={canApprove}
        canSubmit={canSubmit}
        canDispatch={canDispatch}
      />

      {qrDataUrl && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Scan to View / Download</h2>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Anyone who scans this QR code — no login required — gets a PDF of this DC that they
              can view or download on their phone.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="DC QR code" width={120} height={120} />
            <span className="text-[10px] text-slate-400">{dc.dcNumber}</span>
          </div>
        </div>
      )}

      {dc.dispatch && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Dispatch Details</h2>
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-1 text-sm text-slate-700">
              <span>Dispatched At</span><span className="text-right font-mono">{dc.dispatch.dispatchedAt.toLocaleString()}</span>
              <span>Vehicle Number</span><span className="text-right font-mono">{dc.dispatch.vehicleNumber ?? "—"}</span>
              <span>Transporter</span><span className="text-right font-mono">{dc.dispatch.transporter ?? "—"}</span>
              <span>Total Input Weight</span><span className="text-right font-mono">{Number(dc.dispatch.totalInputWeight).toFixed(3)} kg</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Transport &amp; Compliance Details</h2>
          {canRequestAmendment && (
            <EditTransportDialog
              dcId={dc.id}
              vehicleNumber={dc.vehicleNumber}
              transporter={dc.transporter}
              ewayBillNumber={dc.ewayBillNumber}
              eSugamNumber={dc.eSugamNumber}
            />
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Vehicle Number</p>
            <p className="font-mono text-slate-900 font-medium">{dc.vehicleNumber || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Transporter</p>
            <p className="font-mono text-slate-900 font-medium">{dc.transporter || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">E-Way Bill Number</p>
            <p className="font-mono text-slate-900 font-medium">{dc.ewayBillNumber || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">E-Sugam Number</p>
            <p className="font-mono text-slate-900 font-medium">{dc.eSugamNumber || "—"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 bg-white space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">DC Movement Specifications</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Part Number</p>
            <p className="font-mono text-slate-900 font-semibold">{dc.partNumber || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Expected Scrap</p>
            <p className="font-mono text-slate-900 font-semibold">
              {dc.expectedScrap !== null && dc.expectedScrap !== undefined
                ? `${Number(dc.expectedScrap).toFixed(3)} kg`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Work Order ID</p>
            <p className="font-mono text-slate-900 font-medium">{dc.woNumber}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">DC Purpose</p>
            <p className="font-mono text-slate-900 font-medium">{dc.purpose.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 bg-white space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Signatures &amp; Authorization Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Prepared By (Printed)</p>
            <p className="font-semibold text-slate-900">{dc.preparedByName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Approved By (Printed)</p>
            <p className="font-semibold text-slate-900">{dc.approvedByName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Created By (Audit User)</p>
            <p className="text-slate-700">{dc.createdBy ? (auditUserMap.get(dc.createdBy) || dc.createdBy) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Approved By (Audit User)</p>
            <p className="text-slate-700">{dc.approvedBy ? (auditUserMap.get(dc.approvedBy) || dc.approvedBy) : "—"}</p>
          </div>
        </div>
      </div>

      <RecoveryPanel
        dcId={dc.id}
        recoveryTypes={recoveryTypes.map((rt) => ({ id: rt.id, code: rt.code, name: rt.name }))}
        rollup={recoveryRollup}
        receipts={dc.recoveryReceipts.map((r) => ({
          id: r.id,
          recoveryTypeName: r.recoveryType.name,
          weight: Number(r.weight),
          receiptDate: r.receiptDate.toISOString(),
          remarks: r.remarks,
        }))}
        canReceive={canReceiveRecovery}
      />

      <ClassificationPanel
        dcId={dc.id}
        items={dc.items.map((it) => ({
          itemId: it.itemId,
          itemCode: it.item.itemCode,
          itemName: it.item.itemName,
          receivedQty: receivedByItemId.get(it.itemId) ?? 0,
          alreadyClassifiedQty: classifiedByItemId.get(it.itemId) ?? 0,
        }))}
        scrapTypes={scrapTypesForClassification.map((s) => ({ id: s.id, name: s.name }))}
        history={dc.classifications.map((c) => ({
          id: c.id,
          classifiedAt: c.classifiedAt.toISOString(),
          lines: c.items.map((l) => ({
            itemCode: l.item.itemCode,
            receivedQty: Number(l.receivedQty),
            goodQty: Number(l.goodQty),
            scrapQty: Number(l.scrapQty),
            scrapTypeName: l.scrapType?.name ?? null,
          })),
        }))}
        canClassify={canClassify}
      />

      <AmendmentPanel
        dcId={dc.id}
        dcItems={dc.items.map((it) => ({
          id: it.id,
          label: it.item.itemCode + " — " + it.item.itemName,
          quantity: Number(it.quantity),
          weight: Number(it.inputWeight),
        }))}
        amendments={amendments.map((a) => ({
          id: a.id,
          dcItemId: a.dcItemId,
          requestedByName: amendmentUserNameById.get(a.requestedBy) ?? "Unknown",
          requestedAt: a.requestedAt.toISOString(),
          reason: a.reason,
          previousQuantity: Number(a.previousQuantity),
          previousWeight: Number(a.previousWeight),
          newQuantity: Number(a.newQuantity),
          newWeight: Number(a.newWeight),
          status: a.status,
          decidedByName: a.decidedBy ? (amendmentUserNameById.get(a.decidedBy) ?? null) : null,
          decisionReason: a.decisionReason,
        }))}
        canRequest={canRequestAmendment}
        canDecide={canDecideAmendment}
      />

      {canReceiveNow && (
        <ReceiveMaterialForm dcId={dc.id} lines={receiveLines} />
      )}

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Material Returns</h2>
        {dc.receipts.length === 0 ? (
          <p className="text-sm text-slate-400">No material received yet.</p>
        ) : (
          <div className="space-y-3">
            {dc.receipts.map((r) => (
              <div key={r.id} className="rounded-md border border-slate-100 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono font-medium text-slate-800">{r.receiptNumber}</span>
                  <span className="text-slate-500">{r.receiptDate.toLocaleDateString()}</span>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr><th className="py-1">Item</th><th className="text-right">Qty Received</th><th className="text-right">Weight Received</th><th className="text-right">Rejected Qty</th></tr>
                  </thead>
                  <tbody>
                    {r.items.map((line) => {
                      const it = dc.items.find((di) => di.itemId === line.itemId);
                      return (
                        <tr key={line.id} className="border-t border-slate-100">
                          <td className="py-1">{it?.item.itemCode ?? line.itemId}</td>
                          <td className="text-right font-mono">{Number(line.quantityReceived)}</td>
                          <td className="text-right font-mono">{Number(line.weightReceived).toFixed(3)}</td>
                          <td className="text-right font-mono">{Number(line.rejectedQuantity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 p-4 bg-white space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Scrap Recovery &amp; Variance Analysis</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-mono text-slate-700">
          <div>
            <p className="text-xs font-sans text-slate-500 uppercase tracking-wider">Expected Scrap (DC Creation)</p>
            <p className="font-semibold text-slate-900">{expectedScrapWeight.toFixed(3)} kg</p>
          </div>
          <div>
            <p className="text-xs font-sans text-slate-500 uppercase tracking-wider">Actual Scrap Returned</p>
            <p className="font-semibold text-slate-900">{receivedScrapWeight.toFixed(3)} kg</p>
          </div>
          <div>
            <p className="text-xs font-sans text-slate-500 uppercase tracking-wider">Scrap Difference</p>
            <p className={`font-semibold ${expectedScrapWeight - receivedScrapWeight > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {Math.max(expectedScrapWeight - receivedScrapWeight, 0).toFixed(3)} kg
            </p>
          </div>
          <div>
            <p className="text-xs font-sans text-slate-500 uppercase tracking-wider">Recovery Status</p>
            <span
              className={
                scrapEval.status === "SCRAP_SHORT"
                  ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-sans text-red-700"
                  : scrapEval.status === "EXCESS_SCRAP"
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-sans text-amber-700"
                    : scrapEval.status === "NOT_APPLICABLE"
                      ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-sans text-slate-500"
                      : "rounded-full bg-green-100 px-2 py-0.5 text-xs font-sans text-green-700"
              }
            >
              {scrapEval.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {dc.scrapReceipts.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {dc.scrapReceipts.map((r) => (
              <div key={r.id} className="rounded-md border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-slate-800">{r.scrapReceiptNumber}</span>
                  <span className="text-slate-500">{r.receiptDate.toLocaleDateString()}</span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {r.items.map((line) => (
                    <li key={line.id} className="flex justify-between font-mono text-xs text-slate-600">
                      <span>{line.scrapType.name}</span>
                      <span>{Number(line.weight).toFixed(3)} kg</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {dc.reconciliation && (
        <ReconciliationPanel
          dcId={dc.id}
          reconciliation={{
            status: dc.reconciliation.status,
            totalInputWeight: Number(dc.reconciliation.totalInputWeight),
            totalFinishedWeight: Number(dc.reconciliation.totalFinishedWeight),
            totalScrapWeight: Number(dc.reconciliation.totalScrapWeight),
            approvedProcessLoss: Number(dc.reconciliation.approvedProcessLoss),
            accountedWeight: Number(dc.reconciliation.accountedWeight),
            unaccountedWeight: Number(dc.reconciliation.unaccountedWeight),
          }}
          exceptions={dc.exceptions.map((e) => ({
            id: e.id,
            type: e.type,
            description: e.description,
            variance: e.variance ? Number(e.variance) : null,
            status: e.status,
          }))}
          canClose={canCloseDc}
          canOverride={canOverrideException}
        />
      )}

      {canScrapNow && scrapTypes.length > 0 && (
        <ReceiveScrapForm
          dcId={dc.id}
          scrapTypes={scrapTypes.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        />
      )}

      <DocumentsPanel
        entityType="DeliveryChallan"
        entityId={dc.id}
        documents={documents.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileType: d.fileType,
          fileSize: d.fileSize,
          uploadedByName: d.uploadedBy ? (uploaderNameById.get(d.uploadedBy) ?? null) : null,
          uploadedAt: d.uploadedAt.toISOString(),
        }))}
        canUpload={canUploadDocs}
        canDelete={canDeleteDocs}
        revalidateTo={"/dcs/" + dc.id}
      />

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Items</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Item</th><th>Qty</th><th className="text-right">Input</th>
              <th className="text-right">Exp. Finished</th><th className="text-right">Exp. Scrap</th>
              <th className="text-right">Received</th><th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {dc.items.map((it) => {
              const received = receivedByItemId.get(it.itemId) ?? 0;
              const balance = Number(it.quantity) - received;
              return (
                <tr key={it.id} className="border-t border-slate-100">
                  <td className="py-1.5">{it.item.itemCode} — {it.item.itemName}</td>
                  <td>{Number(it.quantity)}</td>
                  <td className="text-right font-mono">{Number(it.inputWeight).toFixed(3)}</td>
                  <td className="text-right font-mono">{Number(it.expectedFinishedWeight).toFixed(3)}</td>
                  <td className="text-right font-mono">{Number(it.expectedScrapWeight).toFixed(3)}</td>
                  <td className="text-right font-mono">{received}</td>
                  <td className="text-right font-mono">{balance.toFixed(3)}</td>
                </tr>
              );
            })}
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