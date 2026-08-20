import { prisma } from "@/lib/db";

export default async function ProcessesPage() {
  const processes = await prisma.process.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Processes</h1>
        <p className="text-sm text-slate-500">{processes.length} process(es)</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {processes.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-slate-700">{p.code}</td>
                <td className="px-4 py-2 text-slate-900">{p.name}</td>
                <td className="px-4 py-2">
                  <span className={p.active ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"}>
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}