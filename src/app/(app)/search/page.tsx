import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";

interface SearchParams {
  q?: string;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const user = await getSessionUser();
  const canView = user ? await hasPermission(user.id, PERMISSIONS.DC_VIEW) : false;

  if (!canView) {
    return <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">You do not have permission to search.</div>;
  }

  if (!q) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Search</h1>
        <p className="text-sm text-slate-500">
          Enter a search term above - DC number, vendor, item code/name, job work order, vehicle number, batch/heat number.
        </p>
      </div>
    );
  }

  const dcs = await prisma.deliveryChallan.findMany({
    where: {
      OR: [
        { dcNumber: { contains: q, mode: "insensitive" } },
        { vehicleNumber: { contains: q, mode: "insensitive" } },
        { jobWorkOrderNumber: { contains: q, mode: "insensitive" } },
        { referenceNumber: { contains: q, mode: "insensitive" } },
        { vendor: { OR: [{ vendorName: { contains: q, mode: "insensitive" } }, { vendorCode: { contains: q, mode: "insensitive" } }] } },
        {
          items: {
            some: {
              OR: [
                { batchNumber: { contains: q, mode: "insensitive" } },
                { heatNumber: { contains: q, mode: "insensitive" } },
                { item: { itemCode: { contains: q, mode: "insensitive" } } },
                { item: { itemName: { contains: q, mode: "insensitive" } } },
              ],
            },
          },
        },
      ],
    },
    include: { vendor: true, process: true, items: { include: { item: true } } },
    orderBy: { dcDate: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Search results for "{q}"</h1>
        <p className="text-sm text-slate-500">{dcs.length} DC(s) matched (showing up to 50)</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">DC No</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Process</th>
              <th className="px-3 py-2 font-medium">Items</th>
              <th className="px-3 py-2 font-medium">Vehicle</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dcs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">No matches found.</td>
              </tr>
            ) : (
              dcs.map((dc) => (
                <tr key={dc.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={"/dcs/" + dc.id} className="font-mono text-blue-700 hover:underline">{dc.dcNumber}</Link>
                  </td>
                  <td className="px-3 py-2 text-slate-900">{dc.vendor.vendorName}</td>
                  <td className="px-3 py-2 text-slate-600">{dc.process?.name ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {dc.items.map((it) => it.item.itemCode).join(", ") || "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{dc.vehicleNumber ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{dc.status.replace(/_/g, " ")}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}