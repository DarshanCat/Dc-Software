import { prisma } from "@/lib/db";
import { requireUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { OutwardDcForm } from "./outward-form";

export const dynamic = "force-dynamic";

export default async function OutwardDcPage() {
  const user = await requireUser();
  const canCreate = await hasPermission(user.id, PERMISSIONS.DC_CREATE);
  if (!canCreate) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        You do not have permission to create Delivery Challans.
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
      addressLine2: true,
      area: true,
      gstNumber: true,
      city: true,
      state: true,
      pincode: true,
      country: true,
    },
    orderBy: { vendorName: "asc" },
  });

  const processes = await prisma.process.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Outgoing Delivery Challan</h1>
        <p className="text-sm text-slate-500">
          Prepare a new outward physical material movement challan for external processing or subcontracting.
        </p>
      </div>

      <OutwardDcForm vendors={vendors} processes={processes} />
    </div>
  );
}
