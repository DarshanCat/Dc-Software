import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { buildDcPublicUrl } from "@/services/dispatch.service";
import { filterDcDataForRole } from "@/server/dcs/sanitizer";
import { DcActions } from "./dc-actions";
import { DocumentsPanel } from "@/components/documents-panel";

export const dynamic = "force-dynamic";

export default async function DcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const dcRaw = await prisma.deliveryChallan.findUnique({
    where: { id },
    include: {
      vendor: true,
      process: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!dcRaw) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm my-12">
        <h2 className="text-lg font-bold text-amber-900 font-sans">Record Not Available</h2>
        <p className="mt-2 text-sm text-amber-800 font-sans">
          This record is no longer available. It may have been removed or you may have followed an outdated link.
        </p>
        <div className="mt-6">
          <a
            href="/dcs"
            className="inline-flex items-center rounded-md bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition-colors font-sans"
          >
            Back to Delivery Challans
          </a>
        </div>
      </div>
    );
  }

  // Server-side payload sanitization
  const userRole = user?.roleKeys?.[0] || "GUEST";
  const dc = filterDcDataForRole(dcRaw, userRole);

  // Permission Checks
  const canSubmit = user ? await hasPermission(user.id, PERMISSIONS.DC_CREATE) : false;
  const canApprove = user ? await hasPermission(user.id, PERMISSIONS.DC_APPROVE) : false;
  const canSecurityDispatch = user ? await hasPermission(user.id, PERMISSIONS.SECURITY_DISPATCH) : false;
  const canConfirmVendor = user ? await hasPermission(user.id, PERMISSIONS.DC_VIEW) : false;
  const canSecurityReturn = user ? await hasPermission(user.id, PERMISSIONS.SECURITY_RETURN) : false;
  const canStoreVerify = user ? await hasPermission(user.id, PERMISSIONS.STORE_VERIFY) : false;
  const canManagerFinalApprove = user ? await hasPermission(user.id, PERMISSIONS.MANAGER_FINAL_APPROVE) : false;
  const canPaymentApprove = user ? await hasPermission(user.id, PERMISSIONS.PAYMENT_APPROVE) : false;
  const canAccountsEntry = user ? await hasPermission(user.id, PERMISSIONS.ACCOUNTS_PAYMENT_ENTRY) : false;
  const canClose = user ? await hasPermission(user.id, PERMISSIONS.DC_CLOSE) : false;
  const canViewHistory = user ? await hasPermission(user.id, PERMISSIONS.DC_HISTORY_FULL) : false;
  const canUploadDocs = user ? await hasPermission(user.id, PERMISSIONS.DOCUMENT_UPLOAD) : false;
  const canDeleteDocs = user ? await hasPermission(user.id, PERMISSIONS.DOCUMENT_DELETE) : false;

  const qrDataUrl = dc.qrToken ? await QRCode.toDataURL(buildDcPublicUrl(dc.qrToken), { margin: 1, width: 160 }) : null;

  const documents = await prisma.document.findMany({
    where: { entityType: "DeliveryChallan", entityId: dc.id },
    orderBy: { uploadedAt: "desc" },
  });

  const auditUserIds = [
    ...new Set(
      [
        dc.createdBy,
        dc.approvedBy,
        dc.securityDispatchedBy,
        dc.securityEnteredBy,
        dc.storeVerifiedBy,
        dc.finalApprovedBy,
        dc.approvedForPaymentBy,
        dc.closedBy,
      ].filter((v): v is string => !!v),
    ),
  ];

  const auditUsers = auditUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: auditUserIds } }, select: { id: true, name: true, email: true } })
    : [];
  const auditUserMap = new Map(auditUsers.map((u) => [u.id, u.name || u.email]));

  // Discrepancy Detection
  const secTotal = Number(dc.actualInwardQty ?? dc.securityFgQuantity ?? 0);
  const storeTotal = Number(dc.storeReceivedQty ?? dc.storeVerifiedFgQuantity ?? 0);
  const goodQty = Number(dc.goodQty ?? dc.finalApprovedFgQuantity ?? 0);
  const rejectQty = Number(dc.rejectionQty ?? dc.finalApprovedRejectionQuantity ?? 0);
  const scrapQty = Number(dc.scrapQty ?? dc.finalApprovedScrapQuantity ?? 0);
  const qualityTotal = goodQty + rejectQty + scrapQty;

  // Next required action prompt & owner mapping
  let nextActionPrompt = "";
  let responsibleRoleText = "";

  switch (dc.status) {
    case "DRAFT":
      nextActionPrompt = "Draft DC created. Click 'Submit Outward DC' to finalize outward dispatch.";
      responsibleRoleText = "Security / PPC";
      break;
    case "OUTWARD_CREATED":
      nextActionPrompt = "Outward DC created. Material ready to move out at gate.";
      responsibleRoleText = "Security Gate";
      break;
    case "MATERIAL_OUT":
    case "DISPATCHED":
    case "AT_VENDOR":
    case "INWARD_PENDING":
      nextActionPrompt = "Material at Supplier. Record Physical Inward Receipt when material arrives back.";
      responsibleRoleText = "Security Gate";
      break;
    case "INWARD_RECEIVED":
    case "SECURITY_RETURNED":
      nextActionPrompt = "Material received at gate. Store confirmation required for inventory entry.";
      responsibleRoleText = "Store Department";
      break;
    case "STORE_CONFIRMED":
    case "QUALITY_PENDING":
      nextActionPrompt = "Store receipt confirmed. Complete Quality Inspection (Good Qty + Rejection Qty + Scrap Qty = Actual Inward Qty).";
      responsibleRoleText = "Quality Department";
      break;
    case "QUALITY_COMPLETED":
    case "MANAGER_APPROVAL_PENDING":
      nextActionPrompt = "Quality Inspection completed. Manager must review full lifecycle and approve for payment.";
      responsibleRoleText = "Manager";
      break;
    case "PAYMENT_APPROVED":
    case "APPROVED_FOR_PAYMENT":
      nextActionPrompt = "Manager payment approval completed. Accounts must record payment details.";
      responsibleRoleText = "Accounts Department";
      break;
    case "CLOSED":
      nextActionPrompt = "DC is CLOSED. Financial payment verified and lifecycle completed.";
      responsibleRoleText = "Completed";
      break;
    default:
      nextActionPrompt = `Current status: ${dc.status.replace(/_/g, " ")}`;
      responsibleRoleText = "Authorized User";
      break;
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* 1. HEADER & STATUS */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-bold text-slate-900">{dc.dcNumber}</h1>
            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-800">
              {dc.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-sans">
            Supplier: <span className="font-semibold text-slate-900">{dc.supplierNameSnapshot || dc.vendor.vendorName}</span>
            {" · "}
            WO ID: <span className="font-mono font-semibold text-slate-800">{dc.woNumber}</span>
            {" · "}
            Part: <span className="font-mono font-semibold text-slate-800">{dc.partNumberSnapshot || dc.partNumber || "N/A"}</span>
            {" · "}
            Department: <span className="font-semibold text-slate-800">{dc.department || "PRODUCTION"}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={"/dcs/" + dc.id + "/pdf"}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            Print / Download PDF
          </a>
        </div>
      </div>

      {/* LIFECYCLE STAGE VISUALIZER & NEXT ACTION BANNER */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">Current Ownership &amp; Next Required Action</p>
          <p className="text-sm font-semibold text-blue-950">{nextActionPrompt}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-blue-600 uppercase block tracking-wider font-semibold">Current Owner</span>
          <span className="rounded bg-blue-200/80 px-2.5 py-1 text-xs font-bold text-blue-900">{responsibleRoleText}</span>
        </div>
      </div>

      {/* ACTION PANEL */}
      <DcActions
        dcId={dc.id}
        status={dc.status}
        userRole={userRole}
        permissions={{
          canSubmit,
          canApprove,
          canSecurityDispatch,
          canConfirmVendor,
          canSecurityReturn,
          canStoreVerify,
          canManagerFinalApprove,
          canPaymentApprove,
          canAccountsEntry,
          canClose,
        }}
        dcData={{
          rmQuantity: dc.outwardQtyRw ? Number(dc.outwardQtyRw) : Number(dc.rmQuantity ?? 0),
          returnFgQuantity: dc.returnFgQuantity ? Number(dc.returnFgQuantity) : null,
          securityDispatchQuantity: dc.outwardWeight ? Number(dc.outwardWeight) : null,
          securityFgQuantity: dc.actualInwardQty ? Number(dc.actualInwardQty) : null,
          securityRejectionQuantity: dc.rejectionQty ? Number(dc.rejectionQty) : null,
          securityScrapQuantity: dc.scrapQty ? Number(dc.scrapQty) : null,
          storeVerifiedFgQuantity: dc.storeReceivedQty ? Number(dc.storeReceivedQty) : null,
          storeVerifiedRejectionQuantity: dc.rejectionQty ? Number(dc.rejectionQty) : null,
          storeVerifiedScrapQuantity: dc.scrapQty ? Number(dc.scrapQty) : null,
          invoiceNumber: dc.invoiceNumber,
          invoiceDate: dc.invoiceDate ? dc.invoiceDate.toISOString().split("T")[0] : null,
          invoiceAmount: dc.pricingSnapshot ? Number(dc.pricingSnapshot) : Number(dc.invoiceAmount ?? 0),
          paymentReferenceNumber: dc.paymentReference || dc.paymentReferenceNumber,
          paymentDate: dc.paymentApprovedAt ? dc.paymentApprovedAt.toISOString().split("T")[0] : null,
        }}
      />

      {/* 1. DOCUMENT & SUPPLIER SNAPSHOT */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          1. Document &amp; Supplier Master Information
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">DC Number</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{dc.dcNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">DC Date</span>
            <span className="font-semibold text-slate-900">{dc.dcDate.toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Supplier Name</span>
            <span className="font-bold text-slate-900">{dc.supplierNameSnapshot || dc.vendor.vendorName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">GST Number</span>
            <span className="font-mono font-semibold text-slate-900">{dc.supplierGstSnapshot || dc.vendor.gstNumber || "N/A"}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Supplier Address</span>
            <span className="text-slate-800">{dc.supplierAddressSnapshot || dc.vendor.address || "N/A"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Department</span>
            <span className="font-semibold text-slate-900">{dc.department || "PRODUCTION"}</span>
          </div>
        </div>
      </div>

      {/* 2. WO, PART & OUTWARD DETAILS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Work Order &amp; Outward Quantities
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">WO ID</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{dc.woNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Part Number</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{dc.partNumberSnapshot || dc.partNumber || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Outward Qty RW</span>
              <span className="font-mono font-bold text-blue-900 text-base">
                {dc.outwardQtyRw != null ? Number(dc.outwardQtyRw).toFixed(3) : Number(dc.rmQuantity ?? 0).toFixed(3)} NOS
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Returning FG Qty</span>
              <span className="font-mono font-bold text-blue-900 text-base">
                {dc.returnFgQuantity != null ? Number(dc.returnFgQuantity).toFixed(3) : "—"} NOS
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            3. Outward Weights &amp; Dimensions
          </h2>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Outward Weight</span>
              <span className="font-mono font-bold text-slate-900">{dc.outwardWeight != null ? `${Number(dc.outwardWeight)} KG` : "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Gating Weight</span>
              <span className="font-mono font-bold text-slate-900">{dc.outwardGatingWeight != null ? `${Number(dc.outwardGatingWeight)} KG` : "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Boring Weight</span>
              <span className="font-mono font-bold text-slate-900">{dc.outwardBoringWeight != null ? `${Number(dc.outwardBoringWeight)} KG` : "—"}</span>
            </div>
          </div>
          {(dc.length || dc.width || dc.height) && (
            <div className="pt-2 border-t text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Dimensions (L × W × H)</span>
              <span className="font-mono font-semibold text-slate-800">
                {dc.length ? `${dc.length}mm` : "—"} × {dc.width ? `${dc.width}mm` : "—"} × {dc.height ? `${dc.height}mm` : "—"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. INWARD & STORE CONFIRMATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            4. Security Physical Inward Receipt
          </h2>
          {dc.actualInwardQty ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Actual Inward Qty</span>
                <span className="font-mono font-bold text-blue-900 text-base">{Number(dc.actualInwardQty)} NOS</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inward Date</span>
                <span className="font-semibold text-slate-900">{dc.inwardDate ? dc.inwardDate.toLocaleDateString() : "—"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inward Doc / Invoice</span>
                <span className="font-mono text-slate-800">{dc.inwardDocumentNo || dc.invoiceNumber || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inward Gating/Boring Wt</span>
                <span className="font-mono text-slate-800">
                  {dc.inwardGatingWeight ? `${dc.inwardGatingWeight} KG` : "—"} / {dc.inwardBoringWeight ? `${dc.inwardBoringWeight} KG` : "—"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Physical inward receipt pending at gate.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            5. Store Receipt Confirmation
          </h2>
          {dc.storeReceivedQty ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Store Received Qty</span>
                <span className="font-mono font-bold text-emerald-900 text-base">{Number(dc.storeReceivedQty)} NOS</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Store Receipt Date</span>
                <span className="font-semibold text-slate-900">{dc.storeReceivedDate ? dc.storeReceivedDate.toLocaleDateString() : "—"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Store Remarks</span>
                <span className="text-slate-800">{dc.storeRemarks || "None"}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Store receipt confirmation pending.</p>
          )}
        </div>
      </div>

      {/* 6. QUALITY INSPECTION SUMMARY (LOCKED) */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5 space-y-3">
        <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wider border-b border-emerald-200/60 pb-2">
          6. Quality Inspection Decision (Locked Quality Department Output)
        </h2>
        {goodQty > 0 || rejectQty > 0 || scrapQty > 0 || dc.qualityDecision ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="rounded bg-white p-3 border border-emerald-200">
              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Good Qty (Passed)</span>
              <span className="font-mono font-bold text-emerald-950 text-lg">{goodQty} NOS</span>
            </div>
            <div className="rounded bg-white p-3 border border-red-200">
              <span className="text-red-700 block text-[10px] uppercase font-bold">Rejection Qty</span>
              <span className="font-mono font-bold text-red-900 text-lg">{rejectQty} NOS</span>
            </div>
            <div className="rounded bg-white p-3 border border-amber-200">
              <span className="text-amber-700 block text-[10px] uppercase font-bold">Scrap Qty</span>
              <span className="font-mono font-bold text-amber-900 text-lg">{scrapQty} NOS</span>
            </div>
            <div className="rounded bg-white p-3 border border-blue-200">
              <span className="text-blue-700 block text-[10px] uppercase font-bold">Quality Decision</span>
              <span className="font-bold text-blue-950 text-sm mt-1 block">{dc.qualityDecision || "PASSED"}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">Quality inspection pending. Material undergoes Quality verification after Store confirmation.</p>
        )}
      </div>

      {/* 7. ACCOUNTS & FINANCIAL CLOSURE */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          7. Accounts Payment &amp; Closure Verification
        </h2>
        {dc.paymentReference || dc.paymentReferenceNumber || dc.paymentStatus ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payment Status</span>
              <span className="font-bold text-emerald-900">{dc.paymentStatus || "COMPLETED"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payment Approved Date</span>
              <span className="font-semibold text-slate-900">{dc.paymentApprovedAt ? dc.paymentApprovedAt.toLocaleDateString() : "—"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pricing / Payable Amount</span>
              <span className="font-mono font-bold text-emerald-800">
                ₹{dc.pricingSnapshot ? Number(dc.pricingSnapshot).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payment Reference</span>
              <span className="font-mono font-semibold text-slate-900">{dc.paymentReference || dc.paymentReferenceNumber || "N/A"}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Payment details pending completion. Admin closure requires mandatory payment details.</p>
        )}
      </div>

      {/* DOCUMENTS PANEL */}
      <DocumentsPanel
        entityType="DeliveryChallan"
        entityId={dc.id}
        documents={documents.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileType: d.fileType,
          fileSize: d.fileSize,
          uploadedByName: d.uploadedBy ? (auditUserMap.get(d.uploadedBy) ?? null) : null,
          uploadedAt: d.uploadedAt.toISOString(),
        }))}
        canUpload={canUploadDocs}
        canDelete={canDeleteDocs}
        revalidateTo={"/dcs/" + dc.id}
      />

      {/* AUDIT TRAIL */}
      {canViewHistory && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
            Audit Trail &amp; Status Lifecycle History
          </h2>
          <ul className="space-y-1.5 text-xs text-slate-600 font-mono">
            {dc.statusHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span>
                  {h.createdAt.toLocaleString("en-IN")} — <span className="font-bold text-slate-800">{h.toStatus}</span>
                  {h.reason ? ` (${h.reason})` : ""}
                </span>
                <span className="text-[10px] text-slate-400">{h.changedBy ? (auditUserMap.get(h.changedBy) || h.changedBy) : "System"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}