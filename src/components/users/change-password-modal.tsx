"use client";

import { useState } from "react";
import { ChangePasswordForm } from "./change-password-form";
import { Button } from "@/components/ui/button";

export function ChangePasswordModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300"
      >
        Change Password
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Change Password</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <ChangePasswordForm onSuccess={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
