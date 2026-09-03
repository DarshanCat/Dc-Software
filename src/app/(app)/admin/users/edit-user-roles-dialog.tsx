"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserRoles } from "@/server/users/actions";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2, Check } from "lucide-react";

interface Props {
  userId: string;
  userName: string;
  currentRoleKeys: string[];
  allRoles: { key: string; name: string }[];
}

export function EditUserRolesDialog({ userId, userName, currentRoleKeys, allRoles }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(currentRoleKeys);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (selectedKeys.length === 0) {
      setError("Select at least one role.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await updateUserRoles(userId, selectedKeys);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline px-2 py-1"
      >
        Change Role
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Change User Roles</h3>
                <p className="text-xs text-slate-500">Update assigned role permissions for {userName}</p>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-xs text-red-600 border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">Roles</label>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3 max-h-48 overflow-y-auto">
                {allRoles.map((r) => {
                  const checked = selectedKeys.includes(r.key);
                  return (
                    <label key={r.key} className="flex items-center gap-2 text-xs text-slate-800 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedKeys([...selectedKeys, r.key]);
                          } else {
                            setSelectedKeys(selectedKeys.filter((k) => k !== r.key));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{r.name} ({r.key})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Save Roles
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
