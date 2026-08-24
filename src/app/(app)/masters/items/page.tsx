import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { ItemForm } from "./item-form";
import { DocumentsPanel } from "@/components/documents-panel";

export const dynamic = "force-dynamic";

interface DocItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedByName: string | null;
  uploadedAt: Date;
}

interface SearchParams {
  q?: string;
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const user = await getSessionUser();
  const canCreate = user ? await hasPermission(user.id, PERMISSIONS.ITEM_CREATE) : false;
  const canUpload = user ? await hasPermission(user.id, PERMISSIONS.DOCUMENT_UPLOAD) : false;
  const canDelete = user ? await hasPermission(user.id, PERMISSIONS.DOCUMENT_DELETE) : false;

  const items = await prisma.item.findMany({
    where: q
      ? {
          OR: [
            { itemCode: { contains: q, mode: "insensitive" } },
            { itemName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { itemCode: "asc" },
  });

  const itemIds = items.map((it) => it.id);
  const docs =
    itemIds.length > 0
      ? await prisma.document.findMany({
          where: { entityType: "Item", entityId: { in: itemIds } },
          orderBy: { uploadedAt: "desc" },
        })
      : [];
  const uploaderIds = [...new Set(docs.map((d) => d.uploadedBy).filter((v): v is string => !!v))];
  const uploaders = uploaderIds.length
    ? await prisma.user.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, name: true } })
    : [];
  const uploaderNameById = new Map(uploaders.map((u) => [u.id, u.name]));

  const docsByItemId = new Map<string, DocItem[]>();
  for (const d of docs) {
    const list = docsByItemId.get(d.entityId) ?? [];
    list.push({
      id: d.id,
      fileName: d.fileName,
      fileType: d.fileType,
      fileSize: d.fileSize,
      uploadedByName: (d.uploadedBy && uploaderNameById.get(d.uploadedBy)) || null,
      uploadedAt: d.uploadedAt,
    });
    docsByItemId.set(d.entityId, list);
  }

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
              <th className="px-4 py-2 font-medium">Files</th>
              <th className="px-4 py-2 font-medium">UOM</th>
              <th className="px-4 py-2 font-medium">Unit Wt (kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No items yet.</td></tr>
            ) : (
              items.map((it) => {
                const itemDocs = docsByItemId.get(it.id) ?? [];
                return (
                  <tr key={it.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-700">{it.itemCode}</td>
                    <td className="px-4 py-2 text-slate-900">{it.itemName}</td>
                    <td className="px-4 py-2 text-slate-600">{it.materialGrade ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{it.drawingNumber ?? "—"}</td>
                    <td className="px-4 py-2">
                      {itemDocs.length > 0 && (
                        <p className="mb-1 text-xs text-slate-500">
                          {itemDocs.length} file{itemDocs.length > 1 ? "s" : ""}
                        </p>
                      )}
                      {(canUpload || itemDocs.length > 0) && (
                        <details>
                          <summary className="cursor-pointer select-none text-xs font-medium text-blue-700 hover:underline">
                            📎 Drawings
                          </summary>
                          <div className="mt-2 w-72">
                            <DocumentsPanel
                              entityType="Item"
                              entityId={it.id}
                              documents={itemDocs.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() }))}
                              canUpload={canUpload}
                              canDelete={canDelete}
                              revalidateTo="/masters/items"
                            />
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{it.defaultUOM}</td>
                    <td className="px-4 py-2 text-slate-600">{it.standardUnitWeight?.toString() ?? "—"}</td>
                  </tr>
                );
              })
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
