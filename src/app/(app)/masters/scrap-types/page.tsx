import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ScrapTypesPage() {
  const scrapTypes = await prisma.scrapType.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Scrap Types</h1>
        <p className="text-sm text-slate-500">{scrapTypes.length} type(s)</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scrapTypes.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-slate-700">{s.code}</td>
                <td className="px-4 py-2 text-slate-900">{s.name}</td>
                <td className="px-4 py-2 text-slate-600">{s.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
