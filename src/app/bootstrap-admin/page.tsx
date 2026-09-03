"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function BootstrapAdminPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/bootstrap-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bootstrap failed.");
        setLoading(false);
        return;
      }

      setSuccess(data.message);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg p-6 shadow-xl border border-slate-200 space-y-4">
        <div className="border-b border-slate-200 pb-3 text-center">
          <h1 className="text-xl font-extrabold text-slate-900">First Administrator Bootstrap</h1>
          <p className="text-xs text-slate-500 mt-1">
            Production One-Time Setup — Creates the initial active Administrator when no admin exists.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-xs font-semibold text-red-800 border border-red-200">
            {error}
          </div>
        )}

        {success ? (
          <div className="rounded-md bg-emerald-50 p-4 text-center text-xs font-bold text-emerald-900 border border-emerald-300 space-y-3">
            <p className="text-sm font-extrabold">{success}</p>
            <div>
              <Link
                href="/login"
                className="inline-block rounded bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Proceed to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Admin Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. System Administrator"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-300 p-2.5 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Admin Email *</label>
              <input
                type="email"
                required
                placeholder="e.g. admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-slate-300 p-2.5 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Strong Password *</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-slate-300 p-2.5 text-xs font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5"
            >
              {loading ? "Bootstrapping Administrator..." : "Bootstrap Initial Admin Account"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
