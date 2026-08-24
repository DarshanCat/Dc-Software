import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { AdjustSequenceForm } from "./adjust-sequence-form";

export const dynamic = "force-dynamic";

export default async function NumberingPage() {
  const user = await getSessionUser();
  const canManage = user ? await hasPermission(user.id, PERMISSIONS.SYSTEM_SETTINGS) : false;

  if (!canManage) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to view numbering configuration.
      </div>
    );
  }

  const sequences = await prisma.numberSequence.findMany({
    orderBy: [{ key: "asc" }, { fiscalYear: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Numbering</h1>
        <p className="text-sm text-slate-500">
          Live counters used to generate DC/receipt/scrap-receipt numbers, concurrency-safe via row locking.
          The next number generated will be <span className="font-mono">current + 1</span>.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Fiscal Year</th>
              <th className="px-3 py-2 font-medium">Prefix</th>
              <th className="px-3 py-2 font-medium">Padding</th>
              <th className="px-3 py-2 font-medium">Current</th>
              <th className="px-3 py-2 font-medium">Next Number Preview</th>
              <th className="px-3 py-2 font-medium">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sequences.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  No sequences yet — one is created automatically the first time each number type is used.
                </td>
              </tr>
            ) : (
              sequences.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono">{s.key}</td>
                  <td className="px-3 py-2 text-slate-600">{s.fiscalYear}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{s.prefix}</td>
                  <td className="px-3 py-2">{s.padding}</td>
                  <td className="px-3 py-2 font-mono">{s.current}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">
                    {s.prefix}{String(s.current + 1).padStart(s.padding, "0")}
                  </td>
                  <td className="px-3 py-2">
                    <AdjustSequenceForm sequenceKey={s.key} fiscalYear={s.fiscalYear} current={s.current} />
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