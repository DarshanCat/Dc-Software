import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getVendorScope } from "@/server/dcs/vendor-scope";
import { ROLE_ALLOWED_STATUSES } from "@/config/dc-visibility";
import { buildDcPublicUrl } from "@/services/dispatch.service";
import { sanitizeCsvCell } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUT_STATUSES = ["APPROVED", "DISPATCHED", "AT_VENDOR", "OUTWARD_CREATED", "MATERIAL_OUT"];
const INWARD_STATUSES = [
  "SECURITY_RETURNED",
  "INWARD_RECEIVED",
  "STORE_VERIFIED",
  "CUSTODIAN_VERIFIED",
  "QUALITY_COMPLETED",
  "FINAL_APPROVED",
  "APPROVED_FOR_PAYMENT",
  "CLOSED",
];

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const canView = await hasPermission(user.id, PERMISSIONS.DC_VIEW);
  if (!canView) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") || undefined;
  const flowParam = (searchParams.get("flow") || "ALL").toUpperCase();
  const materialTypeParam = (searchParams.get("materialType") || searchParams.get("materialCategory") || "ALL").toUpperCase();
  const woNumberParam = searchParams.get("woNumber")?.trim() || undefined;
  const dateFromParam = (searchParams.get("dateFrom") || searchParams.get("dcDateFrom"))?.trim() || undefined;
  const dateToParam = (searchParams.get("dateTo") || searchParams.get("dcDateTo"))?.trim() || undefined;
  const qParam = searchParams.get("q")?.trim() || undefined;

  const roleKeys = user.roleKeys || [];
  const isAdmin = roleKeys.includes("ADMIN");

  const where: Record<string, any> = {
    ...getVendorScope(user),
  };

  // Status & Role Visibility Filters
  if (statusParam) {
    if (statusParam === "DRAFT" || statusParam === "SENT_BACK") {
      where.status = { in: ["DRAFT", "SENT_BACK"] };
    } else {
      where.status = statusParam;
    }
  } else if (!isAdmin) {
    let allowed: string[] = [];
    for (const r of roleKeys) {
      if (ROLE_ALLOWED_STATUSES[r]) {
        allowed = [...allowed, ...ROLE_ALLOWED_STATUSES[r]];
      }
    }
    const uniqueAllowed = [...new Set(allowed)];
    if (uniqueAllowed.length > 0) {
      where.status = { in: uniqueAllowed };
    }
  }

  // Material Flow Filter (OUT vs INWARD)
  if (flowParam === "OUT") {
    if (where.status && typeof where.status === "object" && Array.isArray(where.status.in)) {
      where.status.in = where.status.in.filter((s: string) => OUT_STATUSES.includes(s));
    } else if (typeof where.status === "string") {
      if (!OUT_STATUSES.includes(where.status)) {
        where.status = "__NO_MATCH__";
      }
    } else {
      where.status = { in: OUT_STATUSES };
    }
  } else if (flowParam === "INWARD") {
    if (where.status && typeof where.status === "object" && Array.isArray(where.status.in)) {
      where.status.in = where.status.in.filter((s: string) => INWARD_STATUSES.includes(s));
    } else if (typeof where.status === "string") {
      if (!INWARD_STATUSES.includes(where.status)) {
        where.status = "__NO_MATCH__";
      }
    } else {
      where.status = { in: INWARD_STATUSES };
    }
  }

  // Material Type / Category Filter
  if (materialTypeParam === "PRODUCTION" || materialTypeParam === "CONVERSION") {
    where.OR = [
      { materialType: materialTypeParam },
      { materialCategory: materialTypeParam },
    ];
  } else if (materialTypeParam === "CONTINUOUS_CASTING") {
    where.materialCategory = materialTypeParam;
  }

  // WO Number Filter
  if (woNumberParam) {
    where.woNumber = { contains: woNumberParam, mode: "insensitive" };
  }

  // Date Range Filter
  if (dateFromParam || dateToParam) {
    const dateRange: Record<string, Date> = {};
    if (dateFromParam) {
      dateRange.gte = new Date(`${dateFromParam}T00:00:00.000Z`);
    }
    if (dateToParam) {
      dateRange.lte = new Date(`${dateToParam}T23:59:59.999Z`);
    }
    where.dcDate = dateRange;
  }

  // Keyword Search
  if (qParam) {
    const searchConditions = [
      { dcNumber: { contains: qParam, mode: "insensitive" } },
      { woNumber: { contains: qParam, mode: "insensitive" } },
      { partNumber: { contains: qParam, mode: "insensitive" } },
      { supplierNameSnapshot: { contains: qParam, mode: "insensitive" } },
      { vendor: { vendorName: { contains: qParam, mode: "insensitive" } } },
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchConditions }];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  const dcs = await prisma.deliveryChallan.findMany({
    where,
    orderBy: { dcDate: "desc" },
    include: { vendor: true, process: true },
    take: 5000,
  });

  const headers = [
    "DC Number",
    "DC Date",
    "Status",
    "Material Type",
    "Vendor Code",
    "Vendor Name",
    "Supplier GST",
    "Work Order No",
    "Part Number",
    "RM Qty",
    "RM UOM",
    "Return FG Qty",
    "FG UOM",
    "Weight (KG)",
    "Heat Number",
    "Material Grade",
    "Process Name",
    "Vehicle Number",
    "Transporter",
    "E-Way Bill Number",
    "E-Sugam Number",
    "Expected Return Date",
    "Public Softcopy URL",
  ];

  const rows: string[] = [headers.map((h) => sanitizeCsvCell(h)).join(",")];

  for (const dc of dcs) {
    const weightVal = dc.outwardWeight != null ? Number(dc.outwardWeight).toFixed(3) : "";
    const rmVal = dc.rmQuantity != null ? Number(dc.rmQuantity).toFixed(3) : "";
    const fgVal = dc.returnFgQuantity != null ? Number(dc.returnFgQuantity).toFixed(3) : "";
    const softcopyUrl = dc.qrToken ? buildDcPublicUrl(dc.qrToken) : "";
    const categoryDisplay = dc.materialType || dc.materialCategory || "PRODUCTION";

    const row = [
      dc.dcNumber,
      dc.dcDate.toISOString().slice(0, 10),
      dc.status,
      categoryDisplay,
      dc.vendor?.vendorCode || "",
      dc.vendor?.vendorName || dc.supplierNameSnapshot || "",
      dc.vendor?.gstNumber || dc.supplierGstSnapshot || "",
      dc.woNumber,
      dc.partNumber || "",
      rmVal,
      dc.rmUom || "NOS",
      fgVal,
      dc.fgUom || "NOS",
      weightVal,
      dc.heatNumber || "",
      dc.materialGrade || "",
      dc.process?.name || "",
      dc.vehicleNumber || "",
      dc.transporter || "",
      dc.ewayBillNumber || "",
      dc.eSugamNumber || "",
      dc.expectedReturnDate ? dc.expectedReturnDate.toISOString().slice(0, 10) : "",
      softcopyUrl,
    ];

    rows.push(row.map((val) => sanitizeCsvCell(val)).join(","));
  }

  const csvContent = "\uFEFF" + rows.join("\r\n");
  const filename = `delivery-challans-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
