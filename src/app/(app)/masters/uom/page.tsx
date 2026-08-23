import { prisma } from "@/lib/db";

export default async function UomPage() {
  const uoms = await prisma.uOM.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Units of Measure</h1>
        <p className="text-sm text-slate-500">{uoms.length} UOM(s)</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Weight-based</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {uoms.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No UOMs seeded.</td></tr>
            ) : (
              uoms.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-700">{u.code}</td>
                  <td className="px-4 py-2 text-slate-900">{u.name}</td>
                  <td className="px-4 py-2 text-slate-600">{u.isWeight ? "Yes" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}