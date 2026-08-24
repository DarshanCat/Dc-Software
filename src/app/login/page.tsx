"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, ShieldCheck, Truck, BarChart3 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError("Invalid email or password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        if (
          res.error.includes("awaiting administrator approval") ||
          res.error.includes("not approved")
        ) {
          setError(res.error);
        } else {
          setError("Invalid email or password.");
        }
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-900 font-sans">
      {/* LEFT SIDE: Enterprise Branding Panel (Visible on Desktop) */}
      <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-12 bg-slate-950 text-white border-r border-slate-800/80 overflow-hidden">
        {/* Subtle Engineering Grid Background Pattern */}
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        {/* Top Branding Header */}
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

        {/* Middle Value Proposition */}
        <div className="relative z-10 space-y-6 my-auto max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 border border-blue-500/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            Industrial Material Tracking System
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight">
            DC &amp; Vendor Material Management
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed">
            Manage delivery challans, vendor material movement, returns, boring recovery, and scrap reconciliation in one unified workspace.
          </p>

          {/* Feature Highlights */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-blue-400">
                <Truck className="h-4 w-4" />
              </div>
              <span>Real-time Challan &amp; Dispatch Tracking</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-blue-400">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span>Automated Boring &amp; Scrap Reconciliation</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 border-t border-slate-800/60 pt-4">
          &copy; {new Date().getFullYear()} Vijay Spheroidals. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE: Production Login Form Area */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 lg:p-12 bg-slate-50">
        <div className="w-full max-w-md space-y-8 bg-white p-8 lg:p-10 rounded-xl border border-slate-200/80 shadow-sm">
          {/* Form Header */}
          <div className="space-y-2 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <img
                src="/company-logo.png"
                alt="Vijay Spheroidals Logo"
                className="h-10 w-auto object-contain"
              />
              <div className="lg:hidden text-left">
                <span className="block text-xs font-semibold tracking-wider text-blue-600 uppercase">
                  Vijay Spheroidals
                </span>
                <span className="block text-xs text-slate-500">
                  Material Management
                </span>
              </div>
            </div>

            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500">
              Sign in to DC &amp; Vendor Material Management
            </p>
          </div>

          {/* Login Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-5"
          >
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-10 text-sm focus:ring-2 focus:ring-blue-600 border-slate-300"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-10 pr-10 text-sm focus:ring-2 focus:ring-blue-600 border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message Display */}
            {error && (
              <div
                role="alert"
                className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200/80 font-medium"
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Registration Link */}
          <div className="text-center text-sm text-slate-600 pt-2">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:text-blue-500 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-sm"
            >
              Create an account
            </Link>
          </div>

          {/* Footer branding notice */}
          <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-100">
            Secure Enterprise Authentication &bull; Vijay Spheroidals
          </div>
        </div>
      </div>
    </div>
  );
}