import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { getVendorScope } from "@/server/dcs/vendor-scope";
import { ROLE_ALLOWED_STATUSES } from "@/config/dc-visibility";
import { buildDcPublicUrl } from "@/services/dispatch.service";

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

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

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
  const materialCategoryParam = (searchParams.get("materialCategory") || "ALL").toUpperCase();
  const woNumberParam = searchParams.get("woNumber")?.trim() || undefined;
  const dateFromParam = searchParams.get("dateFrom")?.trim() || undefined;
  const dateToParam = searchParams.get("dateTo")?.trim() || undefined;
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

  // Material Category Filter (PRODUCTION vs CONVERSION)
  if (materialCategoryParam === "PRODUCTION" || materialCategoryParam === "CONVERSION" || materialCategoryParam === "CONTINUOUS_CASTING") {
    where.materialCategory = materialCategoryParam;
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

  // General Search Filter
  if (qParam) {
    where.OR = [
      { dcNumber: { contains: qParam, mode: "insensitive" } },
      { woNumber: { contains: qParam, mode: "insensitive" } },
      { partNumber: { contains: qParam, mode: "insensitive" } },
      { supplierNameSnapshot: { contains: qParam, mode: "insensitive" } },
      { vendor: { vendorName: { contains: qParam, mode: "insensitive" } } },
    ];
  }

  const dcs = await prisma.deliveryChallan.findMany({
    where,
    orderBy: { dcDate: "desc" },
    include: { vendor: true, process: true },
    take: 1000,
  });

  const headers = [
    "DC Number",
    "DC Date",
    "Movement Type",
    "Material Category",
    "Flow",
    "Status",
    "WO ID",
    "Supplier / Vendor",
    "Part Number",
    "Heat Number",
    "Material Grade",
    "Dimensions (MM)",
    "Outward Weight (KG)",
    "RM Qty",
    "RM UOM",
    "Expected FG Qty",
    "FG UOM",
    "Rate Per Qty",
    "Expected Total Amount",
    "Vehicle Number",
    "Transporter",
    "E-Way Bill Number",
    "Softcopy Download URL",
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const dc of dcs) {
    const isOut = OUT_STATUSES.includes(dc.status);
    const isInward = INWARD_STATUSES.includes(dc.status);
    const flowText = isOut ? "Material Out" : isInward ? "Material Inward" : dc.status;
    const catText = dc.materialCategory === "CONTINUOUS_CASTING" ? "Continuous Casting" : dc.materialCategory === "CONVERSION" ? "Conversion Material" : "Production Material";
    const dimText =
      dc.length != null && dc.width != null && dc.height != null
        ? `${Number(dc.length)} × ${Number(dc.width)} × ${Number(dc.height)} MM`
        : "";
    const vendorName = dc.vendor?.vendorName || dc.supplierNameSnapshot || dc.destinationDepartment || "N/A";
    const softcopyUrl = dc.qrToken ? `${buildDcPublicUrl(dc.qrToken)}/pdf` : "";

    const row = [
      dc.dcNumber,
      dc.dcDate.toISOString().split("T")[0],
      dc.movementType,
      catText,
      flowText,
      dc.status.replace(/_/g, " "),
      dc.woNumber || "",
      vendorName,
      dc.partNumberSnapshot || dc.partNumber || "",
      dc.heatNumber || "",
      dc.materialGrade || "",
      dimText,
      dc.outwardWeight != null ? Number(dc.outwardWeight).toFixed(3) : "",
      dc.rmQuantity != null ? Number(dc.rmQuantity).toFixed(3) : "",
      dc.rmUom || "NOS",
      dc.returnFgQuantity != null ? Number(dc.returnFgQuantity).toFixed(3) : "",
      dc.fgUom || "NOS",
      dc.ratePerQuantity != null ? Number(dc.ratePerQuantity).toFixed(2) : "",
      dc.expectedAmount != null ? Number(dc.expectedAmount).toFixed(2) : "",
      dc.vehicleNumber || "",
      dc.transporter || "",
      dc.ewayBillNumber || "",
      softcopyUrl,
    ];

    rows.push(row.map(escapeCsvCell).join(","));
  }

  const csvContent = rows.join("\r\n");
  const fileName = `DC_Report_${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
