"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createScrapType, updateScrapType, toggleScrapTypeStatus, deleteScrapType } from "@/server/masters/scrap-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, CheckCircle, XCircle, Trash2 } from "lucide-react";

export interface ScrapTypeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  active: boolean;
}

interface Props {
  scrapTypes: ScrapTypeRow[];
  canCreate: boolean;
  canEdit: boolean;
}

export function ScrapTypeMasterClient({ scrapTypes, canCreate, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<"CREATE" | "EDIT" | null>(null);
  const [editItem, setEditItem] = useState<ScrapTypeRow | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("KG");

  function openCreate() {
    setCode("");
    setName("");
    setDescription("");
    setUnit("KG");
    setError(null);
    setModal("CREATE");
  }

  function openEdit(st: ScrapTypeRow) {
    setEditItem(st);
    setCode(st.code);
    setName(st.name);
    setDescription(st.description || "");
    setUnit(st.unit || "KG");
    setError(null);
    setModal("EDIT");
  }

  async function handleSave() {
    setBusy(true);
    setError(null);

    let res;
    if (modal === "CREATE") {
      res = await createScrapType({ code, name, description, unit });
    } else if (modal === "EDIT" && editItem) {
      res = await updateScrapType({ id: editItem.id, code, name, description, unit });
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
    setError(null);
    const res = await toggleScrapTypeStatus(id);
    setBusy(false);
    if (res && !res.ok) {
      setError(res.error || "Failed to update scrap type status.");
    } else {
      router.refresh();
    }
  }

  async function handleDelete(st: ScrapTypeRow) {
    if (!confirm(`Are you sure you want to delete Scrap Type "${st.name}"?`)) return;
    setBusy(true);
    setError(null);
    const res = await deleteScrapType(st.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Failed to delete scrap type.");
    } else {
      router.refresh();
    }
  }

  const filtered = scrapTypes.filter(
    (s) =>
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
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
          placeholder="Search Scrap Type Code or Name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-xs font-sans"
        />
        {canCreate && (
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add New Scrap Type
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canEdit && <th className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-slate-400 italic">
                  No Scrap Type records found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{s.code}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.description || "—"}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{s.unit}</td>
                  <td className="px-4 py-3">
                    {s.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <CheckCircle className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                        <XCircle className="h-3.5 w-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(s)} className="text-[11px] h-7 px-2">
                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleToggle(s.id)}
                        className={s.active ? "text-amber-700 h-7 text-[11px]" : "text-emerald-700 h-7 text-[11px]"}
                      >
                        {s.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleDelete(s)}
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
              {modal === "CREATE" ? "Add New Scrap Type" : "Edit Scrap Type"}
            </h3>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs font-medium">{error}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scrap Type Code *</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. BORING, CI_SCRAP"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scrap Type Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cast Iron Boring Scrap"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Machining chips and boring scrap"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measure</label>
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. KG, MT"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {modal === "CREATE" ? "Save Scrap Type" : "Update Scrap Type"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
