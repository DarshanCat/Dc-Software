"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "@/server/auth/password-reset-actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your company email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await requestPasswordReset({ email: email.trim() });
      if (!res.ok) {
        setError(res.error || "Failed to process request. Please try again.");
      } else {
        setSuccessMessage(res.message);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-slate-50 font-sans">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-xl border border-slate-200/80 shadow-sm">
        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-slate-100 p-3 text-slate-800">
              <KeyRound className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Admin Password Recovery
          </h1>
          <p className="text-sm text-slate-500">
            Enter your company email to receive a password reset link
          </p>
        </div>

        {/* Success Alert */}
        {successMessage ? (
          <div className="space-y-4">
            <div className="rounded-md bg-blue-50 p-4 border border-blue-200 text-sm text-blue-800 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900">Request Received</p>
                <p className="mt-1 text-xs text-blue-700">{successMessage}</p>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Return to sign in
              </Link>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Company Email Address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@vijayspheroidals.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-10 text-sm focus:ring-2 focus:ring-blue-600 border-slate-300"
              />
              <p className="text-xs text-slate-400">
                Must be an authorized @vijayspheroidals.com or @vijayspheroidals.onmicrosoft.com address.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200 font-medium text-center"
              >
                {error}
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
                  Sending link...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
