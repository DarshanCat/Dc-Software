"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createVendor, updateVendor, toggleVendorActive, deleteVendor } from "@/server/vendors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface VendorRow {
  id: string;
  vendorCode: string;
  vendorName: string;
  gstNumber: string | null;
  city: string | null;
  state: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  defaultReturnDays: number;
  active: boolean;
  createdAt: string;
}

export function VendorMasterClient({
  vendors,
  canCreate,
  canEdit,
}: {
  vendors: VendorRow[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    vendorCode: "", vendorName: "", gstNumber: "", city: "", state: "", contactPerson: "", phone: "", email: "", defaultReturnDays: 15,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || v.vendorCode.toLowerCase().includes(q) || v.vendorName.toLowerCase().includes(q) || (v.city && v.city.toLowerCase().includes(q));
    const matchStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" && v.active) || (statusFilter === "INACTIVE" && !v.active);
    return matchSearch && matchStatus;
  });

  const openEdit = (v: VendorRow) => {
    setEditingVendor(v);
    setForm({
      vendorCode: v.vendorCode,
      vendorName: v.vendorName,
      gstNumber: v.gstNumber || "",
      city: v.city || "",
      state: v.state || "",
      contactPerson: v.contactPerson || "",
      phone: v.phone || "",
      email: v.email || "",
      defaultReturnDays: v.defaultReturnDays || 15,
    });
    setError(null);
  };

  const openAdd = () => {
    setShowAdd(true);
    setEditingVendor(null);
    setForm({ vendorCode: "", vendorName: "", gstNumber: "", city: "", state: "", contactPerson: "", phone: "", email: "", defaultReturnDays: 15 });
    setError(null);
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditingVendor(null);
    setError(null);
  };

  async function handleSave() {
    setError(null);
    setLoading(true);
    const payload = {
      vendorCode: form.vendorCode.trim(),
      vendorName: form.vendorName.trim(),
      gstNumber: form.gstNumber.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      contactPerson: form.contactPerson.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      defaultReturnDays: Number(form.defaultReturnDays) || 15,
    };

    const res = editingVendor ? await updateVendor(editingVendor.id, payload) : await createVendor(payload);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    closeForm();
    router.refresh();
  }

  async function handleToggleActive(v: VendorRow) {
    setError(null);
    const res = await toggleVendorActive(v.id, !v.active);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function handleDelete(v: VendorRow) {
    if (!confirm(`Are you sure you want to delete vendor "${v.vendorName}"?`)) return;
    setError(null);
    const res = await deleteVendor(v.id);
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
            placeholder="Search vendors by code, name, city..."
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
        {canCreate && !showAdd && !editingVendor && (
          <Button onClick={openAdd}>+ Add Vendor</Button>
        )}
      </div>

      {(showAdd || editingVendor) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {editingVendor ? `Edit Vendor: ${editingVendor.vendorName}` : "Add New Vendor"}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Vendor Code *</label>
              <Input value={form.vendorCode} onChange={(e) => setForm({ ...form, vendorCode: e.target.value })} placeholder="e.g. VEND-001" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Vendor Name *</label>
              <Input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="e.g. Acme Processing" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">GST Number</label>
              <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">City</label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">State</label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Contact Person</label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Default Return (Days)</label>
              <Input type="number" value={form.defaultReturnDays} onChange={(e) => setForm({ ...form, defaultReturnDays: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Vendor"}</Button>
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
              <th className="px-4 py-2 font-medium">GST</th>
              <th className="px-4 py-2 font-medium">City / State</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
              {canEdit && <th className="px-4 py-2 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No vendors match the filter.</td></tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-700">{v.vendorCode}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{v.vendorName}</td>
                  <td className="px-4 py-2 text-slate-600 font-mono text-xs">{v.gstNumber || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{[v.city, v.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{v.contactPerson || v.phone || "—"}</td>
                  <td className="px-4 py-2">
                    <span className={v.active ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"}>
                      {v.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{v.createdAt}</td>
                  {canEdit && (
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={() => openEdit(v)} className="text-xs font-medium text-blue-700 hover:underline">Edit</button>
                      <button onClick={() => handleToggleActive(v)} className="text-xs font-medium text-slate-600 hover:underline">
                        {v.active ? "Deactivate" : "Reactivate"}
                      </button>
                      <button onClick={() => handleDelete(v)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
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
