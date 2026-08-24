"use client";

import { useState } from "react";
import { adminResetPassword } from "@/server/users/actions";
import { Button } from "@/components/ui/button";

interface AdminResetPasswordDialogProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export function AdminResetPasswordDialog({
  userId,
  userName,
  userEmail,
}: AdminResetPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    setError(null);

    const res = await adminResetPassword(userId);
    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setTempPassword(res.temporaryPassword);
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTempPassword(null);
    setError(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-amber-600 hover:text-amber-800 font-medium ml-2 px-2 py-1 rounded border border-amber-200 hover:border-amber-300"
      >
        Reset Password
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Reset User Password</h2>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {!tempPassword ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Are you sure you want to reset password for{" "}
                  <span className="font-semibold text-slate-900">{userName}</span> ({userEmail})?
                </p>

                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                  A secure temporary password will be generated and displayed <strong>ONCE</strong>.
                  The user will be required to change their password upon next login.
                </p>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={handleClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button onClick={handleReset} disabled={loading}>
                    {loading ? "Generating..." : "Generate Temporary Password"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
                  <strong>IMPORTANT:</strong> Copy this temporary password now. It will <strong>NEVER</strong> be displayed again.
                </div>

                <div className="p-3 bg-slate-100 rounded border border-slate-300 font-mono text-center text-lg font-bold text-slate-900 tracking-wider">
                  {tempPassword}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="secondary" onClick={handleCopy}>
                    {copied ? "Copied!" : "Copy Temporary Password"}
                  </Button>
                  <Button onClick={handleClose}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
