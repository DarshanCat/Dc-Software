import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { ItemForm } from "./item-form";

export default async function ItemsPage() {
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.ITEM_CREATE) : false;

  const items = await prisma.item.findMany({ orderBy: { itemCode: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Items</h1>
        <p className="text-sm text-slate-500">{items.length} item(s)</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Grade</th>
              <th className="px-4 py-2 font-medium">Drawing</th>
              <th className="px-4 py-2 font-medium">UOM</th>
              <th className="px-4 py-2 font-medium">Unit Wt (kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No items yet.</td></tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-700">{it.itemCode}</td>
                  <td className="px-4 py-2 text-slate-900">{it.itemName}</td>
                  <td className="px-4 py-2 text-slate-600">{it.materialGrade ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{it.drawingNumber ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{it.defaultUOM}</td>
                  <td className="px-4 py-2 text-slate-600">{it.standardUnitWeight?.toString() ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Add Item</h2>
          <ItemForm />
        </div>
      )}
    </div>
  );
}