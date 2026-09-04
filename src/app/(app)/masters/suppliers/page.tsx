import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { VendorMasterClient } from "../vendors/vendor-master-client";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.VENDOR_CREATE) : false;
  const canEdit = user ? await hasPermission(user.id, PERMISSIONS.VENDOR_EDIT) : false;

  const vendors = await prisma.vendor.findMany({
    orderBy: { vendorName: "asc" },
  });

  const formattedVendors = vendors.map((v) => ({
    id: v.id,
    vendorCode: v.vendorCode,
    vendorName: v.vendorName,
    gstNumber: v.gstNumber,
    city: v.city,
    state: v.state,
    contactPerson: v.contactPerson,
    phone: v.phone,
    email: v.email,
    defaultReturnDays: v.defaultReturnDays,
    active: v.active,
    createdAt: v.createdAt.toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Supplier Master</h1>
        <p className="text-sm text-slate-500">{vendors.length} supplier(s) / vendor(s) registered</p>
      </div>
      <VendorMasterClient vendors={formattedVendors} canCreate={canCreate} canEdit={canEdit} />
    </div>
  );
}
