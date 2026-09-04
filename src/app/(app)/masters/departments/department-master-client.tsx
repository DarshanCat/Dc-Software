"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDepartment, updateDepartment, toggleDepartmentStatus } from "@/server/masters/departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, CheckCircle, XCircle } from "lucide-react";

interface DeptData {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
}

interface Props {
  departments: DeptData[];
  canCreate: boolean;
  canEdit: boolean;
}

export function DepartmentMasterClient({ departments, canCreate, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<"CREATE" | "EDIT" | null>(null);
  const [editDept, setEditDept] = useState<DeptData | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  function openCreate() {
    setCode("");
    setName("");
    setError(null);
    setModal("CREATE");
  }

  function openEdit(dept: DeptData) {
    setEditDept(dept);
    setCode(dept.code);
    setName(dept.name);
    setError(null);
    setModal("EDIT");
  }

  async function handleSave() {
    setBusy(true);
    setError(null);

    let res;
    if (modal === "CREATE") {
      res = await createDepartment({ code, name });
    } else if (modal === "EDIT" && editDept) {
      res = await updateDepartment({ id: editDept.id, code, name });
    }

    setBusy(false);
    if (res && !res.ok) {
      setError(res.error || "Operation failed.");
    } else {
      setModal(null);
      router.refresh();
    }
  }

  async function handleToggle(id: string) {
    setBusy(true);
    await toggleDepartmentStatus(id);
    setBusy(false);
    router.refresh();
  }

  const filtered = departments.filter(
    (d) =>
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Input
          placeholder="Search Department Code or Name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-xs font-sans"
        />
        {canCreate && (
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add New Department
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Department Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                  No department records found.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{d.code}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{d.name}</td>
                  <td className="px-4 py-3">
                    {d.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <CheckCircle className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                        <XCircle className="h-3.5 w-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {canEdit && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openEdit(d)} className="text-[11px] h-7 px-2">
                          <Edit2 className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleToggle(d.id)}
                          className={d.active ? "text-amber-700 h-7 text-[11px]" : "text-emerald-700 h-7 text-[11px]"}
                        >
                          {d.active ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {modal === "CREATE" ? "Add New Department" : "Edit Department"}
            </h3>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Code *</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. PROD"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PRODUCTION"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {modal === "CREATE" ? "Save Department" : "Update Department"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
