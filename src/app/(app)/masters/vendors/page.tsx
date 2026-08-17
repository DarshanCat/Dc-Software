import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { VendorForm } from "./vendor-form";

export default async function VendorsPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.VENDOR_CREATE) : false;

  const vendors = await prisma.vendor.findMany({
    orderBy: { vendorCode: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-500">{vendors.length} vendor(s)</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">City</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Return Days</th>
              <th className="px-4 py-2 font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No vendors yet.
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-700">{v.vendorCode}</td>
                  <td className="px-4 py-2 text-slate-900">{v.vendorName}</td>
                  <td className="px-4 py-2 text-slate-600">{v.city ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{v.contactPerson ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{v.defaultReturnDays}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        v.active
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                      }
                    >
                      {v.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Add Vendor</h2>
          <VendorForm />
        </div>
      )}
    </div>
  );
}