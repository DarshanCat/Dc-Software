"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import {
  validatePasswordResetToken,
  completePasswordReset,
} from "@/server/auth/password-reset-actions";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [tokenValidating, setTokenValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ email: string; name: string } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError("Missing password reset token.");
      setTokenValidating(false);
      return;
    }

    async function checkToken() {
      try {
        const res = await validatePasswordResetToken(token);
        if (!res.ok) {
          setTokenError(res.error);
        } else {
          setUserInfo({ email: res.email, name: res.name });
        }
      } catch {
        setTokenError("Failed to validate reset token.");
      } finally {
        setTokenValidating(false);
      }
    }

    checkToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setFormError("Please complete both password fields.");
      return;
    }

    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const res = await completePasswordReset({
        token,
        newPassword,
        confirmPassword,
      });

      if (!res.ok) {
        setFormError(res.error || "Password reset failed.");
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      } else {
        setResetSuccess(true);
      }
    } catch {
      setFormError("An unexpected error occurred while resetting password.");
    } finally {
      setLoading(false);
    }
  }

  if (tokenValidating) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin mb-2 text-slate-800" />
        <p className="text-sm">Verifying password reset link...</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-3 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-slate-900">Reset Link Invalid</h2>
        <p className="text-sm text-slate-600 max-w-xs mx-auto">{tokenError}</p>
        <div className="pt-2">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center h-9 px-4 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 text-white"
          >
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-3 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-slate-900">Password Reset Complete</h2>
        <p className="text-sm text-slate-600 max-w-xs mx-auto">
          Your administrator password has been updated successfully. You can now sign in.
        </p>
        <div className="pt-2">
          <Button
            onClick={() => router.push("/login")}
            className="w-full h-10 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
          >
            Sign In Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {userInfo && (
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200">
          Resetting password for: <span className="font-semibold text-slate-900">{userInfo.email}</span>
        </div>
      )}

      {/* New Password */}
      <div className="space-y-1.5">
        <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
          New Password
        </label>
        <div className="relative">
          <Input
            id="newPassword"
            name="newPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            className="h-10 pr-10 text-sm focus:ring-2 focus:ring-blue-600 border-slate-300"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {fieldErrors.newPassword && (
          <p className="text-xs text-red-600">{fieldErrors.newPassword}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
          Confirm New Password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          className="h-10 text-sm focus:ring-2 focus:ring-blue-600 border-slate-300"
        />
        {fieldErrors.confirmPassword && (
          <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p>
        )}
      </div>

      <div className="rounded-md bg-slate-50 p-2.5 text-xs text-slate-500 space-y-1 border border-slate-100">
        <p className="font-semibold text-slate-700">Password requirements:</p>
        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
          <li>At least 8 characters long</li>
          <li>At least 1 uppercase and 1 lowercase letter</li>
          <li>At least 1 number and 1 special character</li>
        </ul>
      </div>

      {formError && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200 font-medium">
          {formError}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-10 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating password...
          </span>
        ) : (
          "Set New Password"
        )}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-slate-50 font-sans">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-slate-100 p-3 text-slate-800">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Reset Administrator Password
          </h1>
          <p className="text-sm text-slate-500">
            Establish your new permanent account credentials
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center p-8 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin mb-2 text-slate-800" />
              <p className="text-sm">Loading...</p>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
