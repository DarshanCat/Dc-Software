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

import { canCloseDc } from "@/server/dcs/actions";

export const dynamic = "force-dynamic";

export default async function DcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const dcRaw = await prisma.deliveryChallan.findUnique({
    where: { id },
    include: {
      vendor: true,
      process: true,
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!dcRaw || (user?.roleKeys?.includes("VENDOR") && (!user.vendorId || user.vendorId !== dcRaw.vendorId))) {
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

  const closeEligibility = await canCloseDc(dc.id, user?.id);

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

  const isOtherDc = dc.movementType !== "MATERIAL";
  const isNormalOtherDc = isOtherDc && !dc.isCommercialService;

  // Discrepancy Detection
  const secTotal = Number(dc.actualInwardQty ?? dc.securityFgQuantity ?? 0);
  const storeTotal = Number(dc.storeReceivedQty ?? dc.storeVerifiedFgQuantity ?? 0);
  const goodQty = Number(dc.goodQty ?? dc.finalApprovedFgQuantity ?? 0);
  const rejectQty = Number(dc.rejectionQty ?? dc.finalApprovedRejectionQuantity ?? 0);
  const scrapQty = Number(dc.scrapQty ?? dc.finalApprovedScrapQuantity ?? 0);

  // Next required action prompt & owner mapping
  let nextActionPrompt = "";
  let responsibleRoleText = "";

  if (isNormalOtherDc) {
    switch (dc.status) {
      case "DRAFT":
        nextActionPrompt = "Draft DC created. Ready for direct Security Gate Outward Dispatch (No Manager approval).";
        responsibleRoleText = "Security Gate";
        break;
      case "DISPATCHED":
      case "AT_VENDOR":
      case "MATERIAL_OUT":
        nextActionPrompt = "Property dispatched / with custodian. Security Gate Inward required upon return.";
        responsibleRoleText = "Security Gate";
        break;
      case "SECURITY_RETURNED":
      case "INWARD_RECEIVED":
        nextActionPrompt = "Gate Inward completed. Destination Department / Custodian return verification required.";
        responsibleRoleText = "Destination Custodian";
        break;
      case "CUSTODIAN_VERIFIED":
        nextActionPrompt = "Custodian return verification completed. Ready for closure.";
        responsibleRoleText = "Custodian / Admin";
        break;
      case "CLOSED":
        nextActionPrompt = "DC is CLOSED. Property custody return verified.";
        responsibleRoleText = "Completed";
        break;
      default:
        nextActionPrompt = `Current status: ${dc.status.replace(/_/g, " ")}`;
        responsibleRoleText = "Authorized User";
        break;
    }
  } else {
    switch (dc.status) {
      case "DRAFT":
        nextActionPrompt = "Draft DC created. Click 'Submit for Approval' to send for Manager pre-outward approval.";
        responsibleRoleText = "DC Creator";
        break;
      case "PENDING_APPROVAL":
        nextActionPrompt = "Pre-Outward Manager approval pending. Review DC details before outward gate dispatch.";
        responsibleRoleText = "Manager";
        break;
      case "SENT_BACK":
        nextActionPrompt = "DC sent back by Manager for corrections. Review remarks and resubmit.";
        responsibleRoleText = "DC Creator";
        break;
      case "REJECTED":
        nextActionPrompt = "DC was rejected by Manager. Outward dispatch terminated.";
        responsibleRoleText = "DC Creator";
        break;
      case "APPROVED":
      case "OUTWARD_CREATED":
        nextActionPrompt = "Manager approved DC. Material ready for Security Gate dispatch.";
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
          {isNormalOtherDc ? (
            <p className="mt-1.5 text-xs text-slate-600 font-sans flex flex-wrap items-center gap-2">
              <span>Type: <strong className="font-bold text-slate-900">{dc.movementType.replace(/_/g, " ")}</strong></span>
              <span>·</span>
              <span>Origin: <strong className="font-semibold text-slate-800">{dc.department || "PRODUCTION"}</strong></span>
              <span>·</span>
              <span>Destination: <strong className="font-semibold text-slate-800">{dc.destinationDepartment || "N/A"}</strong></span>
              <span>·</span>
              <span>Custodian: <strong className="font-semibold text-slate-800">{dc.responsibleCustodian || "N/A"}</strong></span>
              <span>·</span>
              <span>Purpose: <strong className="font-semibold text-slate-800">{dc.purpose.replace(/_/g, " ")}</strong></span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500 font-sans">
              Supplier: <span className="font-semibold text-slate-900">{dc.supplierNameSnapshot || dc.vendor?.vendorName || "N/A"}</span>
              {" · "}
              WO ID: <span className="font-mono font-semibold text-slate-800">{dc.woNumber}</span>
              {" · "}
              Part: <span className="font-mono font-semibold text-slate-800">{dc.partNumberSnapshot || dc.partNumber || "N/A"}</span>
              {" · "}
              Department: <span className="font-semibold text-slate-800">{dc.department || "PRODUCTION"}</span>
            </p>
          )}
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
        closeEligibility={closeEligibility}
        dcData={{
          dcNumber: dc.dcNumber,
          movementType: dc.movementType,
          isCommercialService: dc.isCommercialService,
          rmQuantity: dc.outwardQtyRw ? Number(dc.outwardQtyRw) : Number(dc.rmQuantity ?? 0),
          returnFgQuantity: dc.returnFgQuantity ? Number(dc.returnFgQuantity) : null,
          actualInwardQty: dc.actualInwardQty ? Number(dc.actualInwardQty) : null,
          storeReceivedQty: dc.storeReceivedQty ? Number(dc.storeReceivedQty) : null,
          goodQty: dc.goodQty ? Number(dc.goodQty) : null,
          rejectionQty: dc.rejectionQty ? Number(dc.rejectionQty) : null,
          scrapQty: dc.scrapQty ? Number(dc.scrapQty) : null,
          ratePerQuantity: dc.ratePerQuantity ? Number(dc.ratePerQuantity) : null,
          pricingBasis: dc.pricingBasis || "FG",
          securityDispatchQuantity: dc.outwardWeight ? Number(dc.outwardWeight) : null,
          invoiceNumber: dc.invoiceNumber,
          invoiceDate: dc.invoiceDate ? dc.invoiceDate.toISOString().split("T")[0] : null,
          invoiceAmount: dc.invoiceAmount != null ? Number(dc.invoiceAmount) : (dc.pricingSnapshot ? Number(dc.pricingSnapshot) : 0),
          paymentReferenceNumber: dc.paymentReferenceNumber || dc.paymentReference,
          paymentDate: dc.paymentDate ? dc.paymentDate.toISOString().split("T")[0] : null,
        }}
      />

      {/* 1. DOCUMENT & CUSTODY / SUPPLIER SNAPSHOT */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          1. {isNormalOtherDc ? "Delivery Challan & Custody Information" : "Document & Supplier Master Information"}
        </h2>
        {isNormalOtherDc ? (
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
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Movement Type</span>
              <span className="font-bold text-slate-900">{dc.movementType.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Prepared By</span>
              <span className="font-semibold text-slate-900">{dc.preparedByName || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Origin Department</span>
              <span className="font-semibold text-slate-900">{dc.department || "PRODUCTION"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Destination Department</span>
              <span className="font-semibold text-slate-900">{dc.destinationDepartment || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Responsible Custodian</span>
              <span className="font-semibold text-slate-900">{dc.responsibleCustodian || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Movement Purpose</span>
              <span className="font-semibold text-slate-900">{dc.purpose.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Return Required</span>
              <span className="font-bold text-slate-900">{dc.expectedReturnDate ? "YES" : "NO"}</span>
            </div>
            {dc.expectedReturnDate && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Expected Return Date</span>
                <span className="font-mono font-semibold text-slate-900">{dc.expectedReturnDate.toLocaleDateString()}</span>
              </div>
            )}
          </div>
        ) : (
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
              <span className="font-bold text-slate-900">{dc.supplierNameSnapshot || dc.vendor?.vendorName || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">GST Number</span>
              <span className="font-mono font-semibold text-slate-900">{dc.supplierGstSnapshot || dc.vendor?.gstNumber || "N/A"}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Supplier Address</span>
              <span className="text-slate-800">{dc.supplierAddressSnapshot || dc.vendor?.address || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Department</span>
              <span className="font-semibold text-slate-900">{dc.department || "PRODUCTION"}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. ITEM SPECIFICATIONS & CUSTODY ITEMS or MATERIAL WORK ORDER */}
      {isOtherDc ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. {dc.movementType === "COMPANY_PROPERTY" ? "Company Property Items & Condition Out" : "Tool Items & Condition Out"}
          </h2>
          {dc.items && dc.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Item Code / Tag</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Condition Out</th>
                    <th className="px-3 py-2 text-right">Outward Qty</th>
                    <th className="px-3 py-2 text-right">Returned Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dc.items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 font-mono font-bold text-slate-900">{item.itemCode || "—"}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{item.itemDescription}</td>
                      <td className="px-3 py-2 font-semibold text-amber-800">{item.conditionIn || "GOOD"}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{Number(item.quantity)} {item.uom}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800">
                        {item.returnedQuantity ? `${Number(item.returnedQuantity)} ${item.uom}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No line items specified.</p>
          )}
        </div>
      ) : (
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
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Outward Qty RM</span>
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
      )}

      {/* 3. PHYSICAL GATE INWARD */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          3. Security Physical Gate Inward Receipt
        </h2>
        {dc.actualInwardQty ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Actual Inward Qty</span>
              <span className="font-mono font-bold text-blue-900 text-base">{Number(dc.actualInwardQty)} NOS</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inward Date</span>
              <span className="font-semibold text-slate-900">{dc.inwardDate ? dc.inwardDate.toLocaleDateString() : "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Inward Doc / Reference</span>
              <span className="font-mono text-slate-800">{dc.inwardDocumentNo || dc.invoiceNumber || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Remarks</span>
              <span className="text-slate-800">{dc.remarks || "None"}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Physical inward gate receipt pending.</p>
        )}
      </div>

      {/* 4. MATERIAL STORE & QUALITY OR CUSTODIAN VERIFICATION */}
      {!isNormalOtherDc && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              4. Store Receipt Confirmation
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

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5 space-y-3">
            <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wider border-b border-emerald-200/60 pb-2">
              5. Quality Inspection Decision
            </h2>
            {goodQty > 0 || rejectQty > 0 || scrapQty > 0 || dc.qualityDecision ? (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded bg-white p-2.5 border border-emerald-200">
                  <span className="text-emerald-700 block text-[10px] uppercase font-bold">Good Qty</span>
                  <span className="font-mono font-bold text-emerald-950 text-base">{goodQty} NOS</span>
                </div>
                <div className="rounded bg-white p-2.5 border border-red-200">
                  <span className="text-red-700 block text-[10px] uppercase font-bold">Rejection Qty</span>
                  <span className="font-mono font-bold text-red-900 text-base">{rejectQty} NOS</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Quality inspection pending.</p>
            )}
          </div>
        </div>
      )}

      {/* 5. FINANCIAL PAYMENT & CLOSURE (ONLY FOR MATERIAL OR COMMERCIAL SERVICE) */}
      {(!isOtherDc || dc.isCommercialService) && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Accounts Payment &amp; Closure Verification
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
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payable Amount</span>
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
            <p className="text-xs text-slate-400 italic">Payment details pending completion.</p>
          )}
        </div>
      )}

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