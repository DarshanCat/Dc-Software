"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  Truck,
  BarChart3,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import {
  validateActivationToken,
  completeAccountActivation,
} from "@/server/registration/actions";

function ActivateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [verifying, setVerifying] = useState(true);
  const [userInfo, setUserInfo] = useState<{ email: string; fullName: string } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenError("No activation token provided. Please check your activation link.");
      return;
    }

    validateActivationToken(token)
      .then((res) => {
        if (!res.ok) {
          setTokenError(res.error);
        } else {
          setUserInfo({ email: res.email, fullName: res.fullName });
        }
      })
      .catch(() => {
        setTokenError("An error occurred while validating the activation link.");
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [token]);

  async function handleSubmit() {
    setSubmitError(null);
    setFieldErrors({});

    if (!password) {
      setFieldErrors((prev) => ({ ...prev, password: "Password is required." }));
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: "Passwords do not match." }));
      return;
    }

    setSubmitting(true);

    try {
      const res = await completeAccountActivation({
        token,
        password,
        confirmPassword,
      });

      if (!res.ok) {
        setSubmitError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      } else {
        setSuccess(true);
      }
    } catch {
      setSubmitError("An unexpected error occurred during account activation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-900 font-sans">
      {/* LEFT SIDE: Enterprise Branding */}
      <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-12 bg-slate-950 text-white border-r border-slate-800/80 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/10 p-2 backdrop-blur-sm border border-white/10">
              <img
                src="/company-logo.png"
                alt="Vijay Spheroidals Logo"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                Vijay Spheroidals
              </span>
              <h2 className="text-sm font-medium text-slate-300">
                Enterprise Logistics
              </h2>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6 my-auto max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 border border-blue-500/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            Account Activation &amp; Password Setup
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight">
            Activate Your Account
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed">
            Your registration has been approved by an administrator. Set your private password below to activate your account and log in.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-blue-400">
                <Truck className="h-4 w-4" />
              </div>
              <span>One-Time Cryptographic Activation</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-blue-400">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span>Secure Encrypted Password Storage</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 border-t border-slate-800/60 pt-4">
          &copy; {new Date().getFullYear()} Vijay Spheroidals. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE: Password Form / States */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 lg:p-12 bg-slate-50">
        <div className="w-full max-w-md space-y-6 bg-white p-8 lg:p-10 rounded-xl border border-slate-200/80 shadow-sm">
          {verifying ? (
            <div className="space-y-4 text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-sm text-slate-600 font-medium">
                Validating activation token...
              </p>
            </div>
          ) : tokenError ? (
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-amber-100 p-3 text-amber-600">
                  <AlertTriangle className="h-10 w-10" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  Invalid or Expired Activation Link
                </h3>
                <p className="text-sm text-slate-600 bg-amber-50 p-4 rounded-lg border border-amber-200">
                  {tokenError}
                </p>
              </div>

              <p className="text-xs text-slate-500">
                If you believe this is an error, please contact your administrator to request a new activation link.
              </p>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="flex items-center justify-center w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-3 text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  Account Activated Successfully!
                </h3>
                <p className="text-sm text-slate-600">
                  Your private password has been configured and your account is now active.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-medium"
                >
                  Proceed to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2 text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
                  <img
                    src="/company-logo.png"
                    alt="Vijay Spheroidals Logo"
                    className="h-10 w-auto object-contain"
                  />
                </div>

                <h2 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-2">
                  <KeyRound className="h-6 w-6 text-blue-600" />
                  Set Private Password
                </h2>
                <p className="text-sm text-slate-600">
                  Activating account for{" "}
                  <span className="font-semibold text-slate-900">{userInfo?.fullName}</span> (
                  <span className="text-slate-700">{userInfo?.email}</span>)
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
                className="space-y-4"
              >
                {/* Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className={`h-10 pr-10 text-sm focus:ring-2 focus:ring-blue-600 ${
                        fieldErrors.password ? "border-red-500" : "border-slate-300"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    Must be at least 8 characters with uppercase, lowercase, number, &amp; special character.
                  </p>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                    Confirm Password
                  </label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                    className={`h-10 text-sm focus:ring-2 focus:ring-blue-600 ${
                      fieldErrors.confirmPassword ? "border-red-500" : "border-slate-300"
                    }`}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                {/* Submit Error */}
                {submitError && (
                  <div
                    role="alert"
                    className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200/80 font-medium"
                  >
                    {submitError}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-colors"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Activating Account...
                    </span>
                  ) : (
                    "Activate Account & Set Password"
                  )}
                </Button>
              </form>
            </div>
          )}

          <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-100">
            Secure Account Setup &bull; Vijay Spheroidals
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ActivateContent />
    </Suspense>
  );
}
