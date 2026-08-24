"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  Truck,
  BarChart3,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  UserPlus,
} from "lucide-react";
import { ALLOWED_DEPARTMENTS } from "@/lib/validation/registration";
import { submitRegistrationRequest } from "@/server/registration/actions";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [phone, setPhone] = useState("");
  const [requestedDepartment, setRequestedDepartment] = useState<string>("Production");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setFieldErrors({});

    if (!fullName.trim()) {
      setFieldErrors((prev) => ({ ...prev, fullName: "Full name is required." }));
      return;
    }
    if (!email.trim()) {
      setFieldErrors((prev) => ({ ...prev, email: "Email address is required." }));
      return;
    }

    setLoading(true);

    try {
      const res = await submitRegistrationRequest({
        fullName: fullName.trim(),
        email: email.trim(),
        employeeId: employeeId.trim(),
        phone: phone.trim(),
        requestedDepartment: requestedDepartment as any,
        reason: reason.trim(),
      });

      if (!res.ok) {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      } else {
        setSubmittedMessage(res.message);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-900 font-sans">
      {/* LEFT SIDE: Enterprise Branding Panel */}
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
            Controlled User Access Request
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight">
            Request an Account
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed">
            Submit your details to request access to Vijay Spheroidals DC &amp; Vendor Material Management. All account requests are reviewed and approved by an administrator before activation.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-blue-400">
                <Truck className="h-4 w-4" />
              </div>
              <span>Admin-Governed Access &amp; Security</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-blue-400">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span>Departmental Workflows &amp; Audit Trail</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 border-t border-slate-800/60 pt-4">
          &copy; {new Date().getFullYear()} Vijay Spheroidals. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE: Registration Form */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 lg:p-12 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-md space-y-6 bg-white p-8 lg:p-10 rounded-xl border border-slate-200/80 shadow-sm">
          {/* Header */}
          <div className="space-y-2 text-center lg:text-left">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
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

              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Sign in
              </Link>
            </div>

            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-2">
              <UserPlus className="h-6 w-6 text-blue-600" />
              Account Registration Request
            </h2>
            <p className="text-sm text-slate-500">
              Complete the form below to request access from an administrator.
            </p>
          </div>

          {/* Submitted Success Confirmation */}
          {submittedMessage ? (
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-3 text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  Registration Request Submitted
                </h3>
                <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {submittedMessage}
                </p>
              </div>

              <p className="text-xs text-slate-500">
                An administrator will review your request. Once approved, you will receive activation instructions to set your password.
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
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              {/* Full Name */}
              <div className="space-y-1">
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  className={`h-10 text-sm focus:ring-2 focus:ring-blue-600 ${
                    fieldErrors.fullName ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {fieldErrors.fullName && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.fullName}</p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className={`h-10 text-sm focus:ring-2 focus:ring-blue-600 ${
                    fieldErrors.email ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                )}
              </div>

              {/* Employee ID & Phone (Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="employeeId" className="block text-sm font-medium text-slate-700">
                    Employee ID
                  </label>
                  <Input
                    id="employeeId"
                    name="employeeId"
                    type="text"
                    placeholder="e.g. EMP-1042"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm focus:ring-2 focus:ring-blue-600 border-slate-300"
                  />
                  {fieldErrors.employeeId && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.employeeId}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                    Phone Number
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm focus:ring-2 focus:ring-blue-600 border-slate-300"
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Requested Department */}
              <div className="space-y-1">
                <label htmlFor="requestedDepartment" className="block text-sm font-medium text-slate-700">
                  Requested Department <span className="text-red-500">*</span>
                </label>
                <select
                  id="requestedDepartment"
                  name="requestedDepartment"
                  value={requestedDepartment}
                  onChange={(e) => setRequestedDepartment(e.target.value)}
                  disabled={loading}
                  className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                >
                  {ALLOWED_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {fieldErrors.requestedDepartment && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.requestedDepartment}</p>
                )}
              </div>

              {/* Reason / Purpose */}
              <div className="space-y-1">
                <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
                  Reason / Business Purpose <span className="text-xs text-slate-400">(Optional)</span>
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  rows={2}
                  placeholder="Briefly state your role or project requirements..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={loading}
                  className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-none"
                />
                {fieldErrors.reason && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.reason}</p>
                )}
              </div>

              {/* Error Alert */}
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
                    Submitting Request...
                  </span>
                ) : (
                  "Submit Registration Request"
                )}
              </Button>
            </form>
          )}

          {/* Footer branding notice */}
          <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-100">
            Controlled User Access &bull; Vijay Spheroidals
          </div>
        </div>
      </div>
    </div>
  );
}
