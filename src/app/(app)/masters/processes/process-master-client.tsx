"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProcess, updateProcess, toggleProcessActive, deleteProcess } from "@/server/processes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ProcessRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export function ProcessMasterClient({
  processes,
  canCreate,
  canEdit,
}: {
  processes: ProcessRow[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [editingProcess, setEditingProcess] = useState<ProcessRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = processes.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    const matchStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" && p.active) || (statusFilter === "INACTIVE" && !p.active);
    return matchSearch && matchStatus;
  });

  const openEdit = (p: ProcessRow) => {
    setEditingProcess(p);
    setForm({ code: p.code, name: p.name });
    setError(null);
  };

  const openAdd = () => {
    setShowAdd(true);
    setEditingProcess(null);
    setForm({ code: "", name: "" });
    setError(null);
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditingProcess(null);
    setError(null);
  };

  async function handleSave() {
    setError(null);
    setLoading(true);
    const payload = { code: form.code.trim(), name: form.name.trim() };
    const res = editingProcess ? await updateProcess(editingProcess.id, payload) : await createProcess(payload);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    closeForm();
    router.refresh();
  }

  async function handleToggleActive(p: ProcessRow) {
    setError(null);
    const res = await toggleProcessActive(p.id, !p.active);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function handleDelete(p: ProcessRow) {
    if (!confirm(`Are you sure you want to delete process "${p.name}"?`)) return;
    setError(null);
    const res = await deleteProcess(p.id);
    if (!res.ok) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search processes by code, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
        {canCreate && !showAdd && !editingProcess && (
          <Button onClick={openAdd}>+ Add Process</Button>
        )}
      </div>

      {(showAdd || editingProcess) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {editingProcess ? `Edit Process: ${editingProcess.name}` : "Add New Process"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Process Code *</label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MILLING" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Process Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Milling" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Process"}</Button>
            <Button variant="secondary" onClick={closeForm}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
              {canEdit && <th className="px-4 py-2 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No processes match the filter.</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-700">{p.code}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-2">
                    <span className={p.active ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{p.createdAt}</td>
                  {canEdit && (
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={() => openEdit(p)} className="text-xs font-medium text-blue-700 hover:underline">Edit</button>
                      <button onClick={() => handleToggleActive(p)} className="text-xs font-medium text-slate-600 hover:underline">
                        {p.active ? "Deactivate" : "Reactivate"}
                      </button>
                      <button onClick={() => handleDelete(p)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
