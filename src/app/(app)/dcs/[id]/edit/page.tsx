import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { requirePermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { EditDcForm } from "./edit-dc-form";

export default async function EditDcPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  await requirePermission(user, PERMISSIONS.DC_CREATE);

  const { id } = await params;

  const dc = await prisma.deliveryChallan.findUnique({
    where: { id },
  });

  if (!dc) {
    notFound();
  }

  if (dc.status !== "DRAFT" && dc.status !== "SENT_BACK") {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-lg font-bold">DC Cannot Be Edited</h1>
          <p className="mt-2 text-sm">
            Delivery Challan <strong>{dc.dcNumber}</strong> is currently in status{" "}
            <span className="font-semibold text-amber-950">{dc.status}</span> and cannot be modified.
            Only DCs in <strong>DRAFT</strong> or <strong>SENT_BACK</strong> status can be edited.
          </p>
        </div>
      </div>
    );
  }

  const vendors = await prisma.vendor.findMany({
    where: { active: true },
    select: {
      id: true,
      vendorCode: true,
      vendorName: true,
      address: true,
      gstNumber: true,
      city: true,
      state: true,
    },
    orderBy: { vendorName: "asc" },
  });

  const rawItems = await prisma.itemMaster.findMany({
    where: { active: true },
    select: {
      id: true,
      partNumber: true,
      partDescription: true,
      ratePerQuantity: true,
    },
    orderBy: { partNumber: "asc" },
  });

  const rawDepartments = await prisma.department.findMany({
    where: { active: true },
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Serialize Decimal objects to avoid Next.js Client Component serialization errors
  const items = rawItems.map((item) => ({
    id: item.id,
    itemCode: item.partNumber,
    itemName: item.partNumber,
    description: item.partDescription,
    rate: item.ratePerQuantity ? Number(item.ratePerQuantity.toString()) : null,
  }));

  const serializedDc = {
    id: dc.id,
    dcNumber: dc.dcNumber,
    vendorId: dc.vendorId,
    department: dc.department || "PRODUCTION",
    woNumber: dc.woNumber,
    partNumber: dc.partNumber,
    partDescriptionSnapshot: dc.partDescriptionSnapshot,
    outwardQtyRw: dc.outwardQtyRw ? Number(dc.outwardQtyRw.toString()) : null,
    returningFgQuantity: dc.returnFgQuantity ? Number(dc.returnFgQuantity.toString()) : null,
    outwardWeight: dc.outwardWeight ? Number(dc.outwardWeight.toString()) : null,
    outwardGatingWeight: dc.outwardGatingWeight ? Number(dc.outwardGatingWeight.toString()) : null,
    outwardBoringWeight: dc.outwardBoringWeight ? Number(dc.outwardBoringWeight.toString()) : null,
    length: dc.length ? Number(dc.length.toString()) : null,
    width: dc.width ? Number(dc.width.toString()) : null,
    height: dc.height ? Number(dc.height.toString()) : null,
    pricingBasis: (dc.pricingBasis as "RW" | "FG") || "RW",
    ratePerQuantity: dc.ratePerQuantity ? Number(dc.ratePerQuantity.toString()) : null,
    remarks: dc.remarks,
    status: dc.status,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Edit Delivery Challan — {dc.dcNumber}</h1>
        <p className="text-sm text-slate-500">
          Modify draft or sent-back DC details. Use Enter and arrow keys for Tally-style fast data entry.
        </p>
      </div>

      <EditDcForm
        dc={serializedDc}
        vendors={vendors}
        items={items}
        departments={rawDepartments}
      />
    </div>
  );
}
