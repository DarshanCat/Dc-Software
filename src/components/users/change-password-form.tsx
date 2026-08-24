"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/server/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  isForced?: boolean;
}

export function ChangePasswordForm({ onSuccess, isForced = false }: ChangePasswordFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setSuccessMsg(null);

    const res = await changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      if (res.fieldErrors) {
        setFieldErrors(res.fieldErrors);
      }
      return;
    }

    setSuccessMsg("Password changed successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 border border-green-200">
          {successMsg}
        </div>
      )}

      {isForced && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200 font-medium">
          Your account password was reset or flagged for change. Please update your password to continue.
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
          Current Password
        </label>
        <Input
          name="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
          required
        />
        {fieldErrors.currentPassword && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.currentPassword}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
          New Password
        </label>
        <Input
          name="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password (8+ chars, upper, lower, number, special)"
          required
        />
        {fieldErrors.newPassword && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.newPassword}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
          Confirm New Password
        </label>
        <Input
          name="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
          required
        />
        {fieldErrors.confirmPassword && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
        )}
      </div>

      <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
        <p className="font-semibold text-slate-700">Password requirements:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>At least 8 characters long</li>
          <li>At least one uppercase letter (A-Z)</li>
          <li>At least one lowercase letter (a-z)</li>
          <li>At least one number (0-9)</li>
          <li>At least one special character (!@#$%^&*)</li>
        </ul>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Updating Password..." : "Change Password"}
      </Button>
    </form>
  );
}
