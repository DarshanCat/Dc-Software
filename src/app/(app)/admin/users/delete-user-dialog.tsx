"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { deleteUser } from "@/server/users/actions";

interface DeleteUserDialogProps {
  userId: string;
  userName: string;
  userEmail: string;
  isSelf: boolean;
  isProtected: boolean;
  isAdmin: boolean;
}

export function DeleteUserDialog({
  userId,
  userName,
  userEmail,
  isSelf,
  isProtected,
  isAdmin,
}: DeleteUserDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = isSelf || isProtected;

  async function handleDelete() {
    if (confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
      setError("Entered email does not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await deleteUser(userId, confirmEmail.trim());
      if (!res.ok) {
        setError(res.error || "Failed to delete user.");
      } else {
        setOpen(false);
        setConfirmEmail("");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred while deleting user.");
    } finally {
      setLoading(false);
    }
  }

  if (isDisabled) {
    return (
      <button
        disabled
        title={isSelf ? "You cannot delete your own account" : "Protected administrator account"}
        className="inline-flex items-center gap-1 h-8 px-2 text-xs font-medium rounded-md bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span>Delete</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setError(null);
          setConfirmEmail("");
        }}
        className="inline-flex items-center gap-1 h-8 px-2 text-xs font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span>Delete</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-600 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete User?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This action removes or deactivates <strong>{userName}</strong> ({userEmail}). Historical DC and audit records will be preserved for business accountability.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label htmlFor="confirmEmail" className="block text-xs font-medium text-slate-700">
                Type <span className="font-bold text-slate-900 select-all">{userEmail}</span> to confirm:
              </label>
              <Input
                id="confirmEmail"
                name="confirmEmail"
                type="email"
                placeholder="Enter user email address"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                disabled={loading}
                className="h-9 text-xs border-slate-300"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-md bg-red-50 p-2.5 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="h-8 px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={loading || confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()}
                className="h-8 px-3 text-xs font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  "Delete User"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
