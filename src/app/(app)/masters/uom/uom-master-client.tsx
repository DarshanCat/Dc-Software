"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUOM, updateUOM, deleteUOM } from "@/server/masters/uom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, Trash2 } from "lucide-react";

export interface UOMRow {
  id: string;
  code: string;
  name: string;
  isWeight: boolean;
}

interface Props {
  uoms: UOMRow[];
  canCreate: boolean;
  canEdit: boolean;
}

export function UOMMasterClient({ uoms, canCreate, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<"CREATE" | "EDIT" | null>(null);
  const [editUom, setEditUom] = useState<UOMRow | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isWeight, setIsWeight] = useState(false);

  function openCreate() {
    setCode("");
    setName("");
    setIsWeight(false);
    setError(null);
    setModal("CREATE");
  }

  function openEdit(u: UOMRow) {
    setEditUom(u);
    setCode(u.code);
    setName(u.name);
    setIsWeight(u.isWeight);
    setError(null);
    setModal("EDIT");
  }

  async function handleSave() {
    setBusy(true);
    setError(null);

    let res;
    if (modal === "CREATE") {
      res = await createUOM({ code, name, isWeight });
    } else if (modal === "EDIT" && editUom) {
      res = await updateUOM({ id: editUom.id, code, name, isWeight });
    }

    setBusy(false);
    if (res && !res.ok) {
      setError(res.error || "Operation failed.");
    } else {
      setModal(null);
      router.refresh();
    }
  }

  async function handleDelete(u: UOMRow) {
    if (!confirm(`Are you sure you want to delete UOM "${u.code}"?`)) return;
    setBusy(true);
    setError(null);
    const res = await deleteUOM(u.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Failed to delete UOM.");
    } else {
      router.refresh();
    }
  }

  const filtered = uoms.filter(
    (u) =>
      u.code.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Input
          placeholder="Search UOM Code or Name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-xs font-sans"
        />
        {canCreate && (
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add New UOM
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Weight-based</th>
              {canEdit && <th className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-slate-400 italic">
                  No UOM records found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{u.code}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.isWeight ? "Yes" : "No"}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(u)} className="text-[11px] h-7 px-2">
                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleDelete(u)}
                        className="text-red-600 hover:text-red-700 text-[11px] h-7 px-2"
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </td>
                  )}
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
              {modal === "CREATE" ? "Add New Unit of Measure" : "Edit Unit of Measure"}
            </h3>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">UOM Code *</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. KG, NOS, MTR"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">UOM Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kilogram, Numbers, Meter"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isWeight"
                  checked={isWeight}
                  onChange={(e) => setIsWeight(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isWeight" className="text-xs font-semibold text-slate-700">
                  Is Weight-based unit (e.g. KG, MT)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {modal === "CREATE" ? "Save UOM" : "Update UOM"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
