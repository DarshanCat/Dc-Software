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

  // Server-side blind payload sanitization
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

  // Discrepancy Detection logic for Manager/Admin comparison
  const secTotal = Number(dc.securityFgQuantity ?? 0) + Number(dc.securityRejectionQuantity ?? 0) + Number(dc.securityScrapQuantity ?? 0);
  const storeTotal = Number(dc.storeVerifiedFgQuantity ?? 0) + Number(dc.storeVerifiedRejectionQuantity ?? 0) + Number(dc.storeVerifiedScrapQuantity ?? 0);
  const expFg = Number(dc.returnFgQuantity ?? 0);
  const hasDiscrepancy = (dc.securityFgQuantity != null && dc.storeVerifiedFgQuantity != null && secTotal !== storeTotal) || (storeTotal > 0 && storeTotal !== expFg);

  // Next required action prompt text
  let nextActionPrompt = "";
  let responsibleRoleText = "";

  switch (dc.status) {
    case "DRAFT":
      nextActionPrompt = "DC Created (DRAFT). Click 'Submit for Approval' to send to Manager.";
      responsibleRoleText = "Creator / Stores";
      break;
    case "PENDING_APPROVAL":
      nextActionPrompt = "Pending Manager Approval. Authorized Approver must review and Approve or Return to Draft.";
      responsibleRoleText = "Manager / Approver";
      break;
    case "APPROVED":
      nextActionPrompt = "Approved. Security must perform dispatch entry when material leaves gate.";
      responsibleRoleText = "Security";
      break;
    case "DISPATCHED":
      nextActionPrompt = "Dispatched. Confirm vendor receipt when material reaches vendor.";
      responsibleRoleText = "Stores / Manager";
      break;
    case "AT_VENDOR":
      nextActionPrompt = "Material is at Vendor for processing. Security return entry required when material returns.";
      responsibleRoleText = "Security";
      break;
    case "SECURITY_RETURNED":
      nextActionPrompt = "Security Return recorded. Store must inspect and record Store Verification quantities.";
      responsibleRoleText = "Stores";
      break;
    case "STORE_VERIFIED":
      nextActionPrompt = "Store Verification complete. Manager must compare entries and set Final Approved Quantities.";
      responsibleRoleText = "Manager / Admin";
      break;
    case "FINAL_APPROVED":
      nextActionPrompt = "Final Approved quantities set. Manager/Admin must mark 'Approve for Payment'.";
      responsibleRoleText = "Manager / Admin";
      break;
    case "APPROVED_FOR_PAYMENT":
      nextActionPrompt = "Approved for Payment. Accounts must record Invoice/Payment details and click CLOSE DC.";
      responsibleRoleText = "Accounts";
      break;
    case "CLOSED":
      nextActionPrompt = "DC is CLOSED. All operational and financial entries are locked.";
      responsibleRoleText = "Completed";
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
            Work Order: <span className="font-mono font-semibold text-slate-800">{dc.woNumber}</span>
            {dc.partNumber ? ` · Part No: ${dc.partNumber}` : ""}
            {" · "}
            {dc.vendor.vendorName} · {dc.process?.name ?? "—"}
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

      {/* NEXT ACTION BANNER */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">Next Required Action</p>
          <p className="text-sm font-semibold text-blue-950">{nextActionPrompt}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-blue-600 uppercase block tracking-wider font-semibold">Responsible Role</span>
          <span className="rounded bg-blue-200/80 px-2 py-0.5 text-xs font-bold text-blue-900">{responsibleRoleText}</span>
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
          rmQuantity: dc.rmQuantity ? Number(dc.rmQuantity) : null,
          returnFgQuantity: dc.returnFgQuantity ? Number(dc.returnFgQuantity) : null,
          securityDispatchQuantity: dc.securityDispatchQuantity ? Number(dc.securityDispatchQuantity) : null,
          securityFgQuantity: dc.securityFgQuantity ? Number(dc.securityFgQuantity) : null,
          securityRejectionQuantity: dc.securityRejectionQuantity ? Number(dc.securityRejectionQuantity) : null,
          securityScrapQuantity: dc.securityScrapQuantity ? Number(dc.securityScrapQuantity) : null,
          storeVerifiedFgQuantity: dc.storeVerifiedFgQuantity ? Number(dc.storeVerifiedFgQuantity) : null,
          storeVerifiedRejectionQuantity: dc.storeVerifiedRejectionQuantity ? Number(dc.storeVerifiedRejectionQuantity) : null,
          storeVerifiedScrapQuantity: dc.storeVerifiedScrapQuantity ? Number(dc.storeVerifiedScrapQuantity) : null,
          invoiceNumber: dc.invoiceNumber,
          invoiceDate: dc.invoiceDate ? dc.invoiceDate.toISOString().split("T")[0] : null,
          invoiceAmount: dc.invoiceAmount ? Number(dc.invoiceAmount) : null,
          paymentReferenceNumber: dc.paymentReferenceNumber,
          paymentDate: dc.paymentDate ? dc.paymentDate.toISOString().split("T")[0] : null,
        }}
      />

      {/* 2. BASIC INFORMATION */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          1. Basic Information
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
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Work Order No.</span>
            <span className="font-mono font-bold text-slate-900">{dc.woNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Part Number</span>
            <span className="font-mono font-bold text-slate-900">{dc.partNumber || "—"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vendor Name</span>
            <span className="font-bold text-slate-900">{dc.vendor.vendorName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Process</span>
            <span className="font-semibold text-slate-900">{dc.process?.name || "—"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Purpose</span>
            <span className="font-semibold text-slate-900">{dc.purpose.replace(/_/g, " ")}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Heat Number</span>
            <span className="font-mono font-semibold text-slate-900">{dc.heatNumber || "—"}</span>
          </div>
        </div>
      </div>

      {/* 3. MATERIAL SPECIFICATIONS & 4. MANDATORY PRICING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Material Quantities
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">RM Quantity (Sent)</span>
              <span className="font-mono font-bold text-slate-900 text-base">
                {dc.rmQuantity != null ? Number(dc.rmQuantity).toFixed(3) : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Expected Return FG Qty</span>
              <span className="font-mono font-bold text-slate-900 text-base">
                {dc.returnFgQuantity != null ? Number(dc.returnFgQuantity).toFixed(3) : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-5 space-y-3">
          <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wider border-b border-blue-200/60 pb-2">
            3. Pricing &amp; Commercial Terms
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-blue-600 block text-[10px] uppercase font-bold">Pricing Basis</span>
              <span className="font-bold text-blue-950 text-sm">
                {dc.pricingBasis === "RM" ? "RM Quantity" : dc.pricingBasis === "FG" ? "FG Quantity" : "—"}
              </span>
            </div>
            <div>
              <span className="text-blue-600 block text-[10px] uppercase font-bold">Rate Per Quantity</span>
              <span className="font-mono font-bold text-blue-950 text-sm">
                ₹{dc.ratePerQuantity != null ? Number(dc.ratePerQuantity).toFixed(2) : "—"}
              </span>
            </div>
            <div>
              <span className="text-blue-600 block text-[10px] uppercase font-bold">Original Expected Amount</span>
              <span className="font-mono font-bold text-blue-950">
                ₹{dc.expectedAmount != null ? Number(dc.expectedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
              </span>
            </div>
            <div>
              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Final Payable Amount</span>
              <span className="font-mono font-bold text-emerald-900 text-sm">
                ₹{dc.finalPayableAmount != null ? Number(dc.finalPayableAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "Pending Manager Approval"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. DISPATCH DETAILS */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          4. Security Dispatch Details
        </h2>
        {dc.securityDispatchedAt ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Actual Dispatched Qty</span>
              <span className="font-mono font-bold text-slate-900">{Number(dc.securityDispatchQuantity).toFixed(3)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dispatch Date &amp; Time</span>
              <span className="font-semibold text-slate-900">{dc.securityDispatchDate ? dc.securityDispatchDate.toLocaleDateString() : "—"} {dc.securityDispatchTime || ""}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vehicle Number</span>
              <span className="font-mono font-semibold text-slate-900">{dc.securityDispatchVehicleNumber || dc.vehicleNumber || "—"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Transporter</span>
              <span className="font-semibold text-slate-900">{dc.securityDispatchTransporter || dc.transporter || "—"}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Security dispatch entry pending.</p>
        )}
      </div>

      {/* 6. SECURITY RETURN & 7. STORE VERIFICATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security Return (Hidden for Stores) */}
        {userRole !== "STORES" && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              5. Security Return Gate Entry
            </h2>
            {dc.securityEnteredAt ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">Returned FG</span>
                    <span className="font-bold text-slate-900">{Number(dc.securityFgQuantity).toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">Rejection Qty</span>
                    <span className="font-bold text-amber-700">{Number(dc.securityRejectionQuantity).toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">Scrap Qty</span>
                    <span className="font-bold text-slate-700">{Number(dc.securityScrapQuantity).toFixed(3)}</span>
                  </div>
                </div>
                {dc.securityReturnRemarks && (
                  <p className="text-slate-600 bg-slate-50 p-2 rounded text-[11px]">
                    <span className="font-semibold">Gate Remarks:</span> {dc.securityReturnRemarks}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Security return entry pending.</p>
            )}
          </div>
        )}

        {/* Store Verification (Hidden for Security) */}
        {userRole !== "SECURITY" && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              6. Store Material Verification
            </h2>
            {dc.storeVerifiedAt ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">Verified FG</span>
                    <span className="font-bold text-slate-900">{Number(dc.storeVerifiedFgQuantity).toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">Verified Rejection</span>
                    <span className="font-bold text-amber-700">{Number(dc.storeVerifiedRejectionQuantity).toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-sans font-semibold uppercase">Verified Scrap</span>
                    <span className="font-bold text-slate-700">{Number(dc.storeVerifiedScrapQuantity).toFixed(3)}</span>
                  </div>
                </div>
                {dc.storeRemarks && (
                  <p className="text-slate-600 bg-slate-50 p-2 rounded text-[11px]">
                    <span className="font-semibold">Store Remarks:</span> {dc.storeRemarks}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Store verification pending.</p>
            )}
          </div>
        )}
      </div>

      {/* 8. MANAGER COMPARISON & FINAL APPROVED QUANTITIES */}
      {["ADMIN", "MANAGEMENT", "ACCOUNTS"].includes(userRole) && (
        <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
            <h2 className="text-sm font-bold text-teal-950 uppercase tracking-wider">
              7. Manager Comparison &amp; Final Approved Quantities
            </h2>
            {hasDiscrepancy && (
              <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-bold text-amber-900">
                ⚠ Quantity Discrepancy Detected
              </span>
            )}
          </div>

          <table className="w-full text-left text-xs bg-white rounded border border-slate-200 overflow-hidden">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Entry Stage</th>
                <th className="px-3 py-2 text-right">FG Quantity</th>
                <th className="px-3 py-2 text-right">Rejection Qty</th>
                <th className="px-3 py-2 text-right">Scrap Qty</th>
                <th className="px-3 py-2 text-right">Total Returned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              <tr>
                <td className="px-3 py-2 font-sans font-semibold text-slate-700">Security Gate Return</td>
                <td className="px-3 py-2 text-right">{dc.securityFgQuantity != null ? Number(dc.securityFgQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2 text-right text-amber-700">{dc.securityRejectionQuantity != null ? Number(dc.securityRejectionQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2 text-right text-slate-600">{dc.securityScrapQuantity != null ? Number(dc.securityScrapQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2 text-right font-bold">{dc.securityFgQuantity != null ? secTotal.toFixed(3) : "—"}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-sans font-semibold text-slate-700">Store Verification</td>
                <td className="px-3 py-2 text-right">{dc.storeVerifiedFgQuantity != null ? Number(dc.storeVerifiedFgQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2 text-right text-amber-700">{dc.storeVerifiedRejectionQuantity != null ? Number(dc.storeVerifiedRejectionQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2 text-right text-slate-600">{dc.storeVerifiedScrapQuantity != null ? Number(dc.storeVerifiedScrapQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2 text-right font-bold">{dc.storeVerifiedFgQuantity != null ? storeTotal.toFixed(3) : "—"}</td>
              </tr>
              <tr className="bg-teal-50/70 font-bold">
                <td className="px-3 py-2.5 font-sans text-teal-950 uppercase text-[11px]">Final Approved (Manager)</td>
                <td className="px-3 py-2.5 text-right text-teal-950">{dc.finalApprovedFgQuantity != null ? Number(dc.finalApprovedFgQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-amber-900">{dc.finalApprovedRejectionQuantity != null ? Number(dc.finalApprovedRejectionQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-slate-800">{dc.finalApprovedScrapQuantity != null ? Number(dc.finalApprovedScrapQuantity).toFixed(3) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-teal-950">
                  {dc.finalApprovedFgQuantity != null
                    ? (Number(dc.finalApprovedFgQuantity) + Number(dc.finalApprovedRejectionQuantity ?? 0) + Number(dc.finalApprovedScrapQuantity ?? 0)).toFixed(3)
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>

          {dc.managerCorrectionRemarks && (
            <div className="bg-white p-3 rounded border border-teal-200 text-xs">
              <span className="font-bold text-teal-950 block">Manager Correction Remarks:</span>
              <p className="text-slate-700 mt-0.5">{dc.managerCorrectionRemarks}</p>
            </div>
          )}
        </div>
      )}

      {/* 9. ACCOUNTS PAYMENT INFORMATION */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          8. Accounts Invoice &amp; Payment Details
        </h2>
        {dc.invoiceNumber ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Invoice Number</span>
              <span className="font-mono font-bold text-slate-900">{dc.invoiceNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Invoice Date</span>
              <span className="font-semibold text-slate-900">{dc.invoiceDate ? dc.invoiceDate.toLocaleDateString() : "—"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Invoice Amount</span>
              <span className="font-mono font-bold text-emerald-800">
                ₹{dc.invoiceAmount != null ? Number(dc.invoiceAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payment Reference</span>
              <span className="font-mono font-semibold text-slate-900">{dc.paymentReferenceNumber || "—"}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Invoice and payment details pending Accounts entry.</p>
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

      {/* 10. AUDIT & STATUS HISTORY (RESTRICTED SERVER-SIDE TO ADMIN, MANAGEMENT, ACCOUNTS) */}
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