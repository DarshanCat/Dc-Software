"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStoreDimensions } from "@/server/dcs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ruler, Lock, CheckCircle2, AlertCircle } from "lucide-react";

interface StoresDimensionFormProps {
  dcId: string;
  initialLength: number | null;
  initialWidth: number | null;
  initialHeight: number | null;
  status: string;
  movementType: string;
  canEditDimensions: boolean;
}

export function StoresDimensionForm({
  dcId,
  initialLength,
  initialWidth,
  initialHeight,
  status,
  movementType,
  canEditDimensions,
}: StoresDimensionFormProps) {
  const router = useRouter();
  const [length, setLength] = useState<string>(initialLength ? String(initialLength) : "");
  const [width, setWidth] = useState<string>(initialWidth ? String(initialWidth) : "");
  const [height, setHeight] = useState<string>(initialHeight ? String(initialHeight) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (movementType !== "MATERIAL") return null;

  const isEditableStatus = status === "DRAFT" || status === "PENDING_APPROVAL";
  const isLocked = !isEditableStatus;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    setError(null);
    setSuccess(null);

    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);

    if (isNaN(l) || l <= 0 || isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
      setError("Length, Width, and Height are all required positive numbers in MM.");
      return;
    }

    setLoading(true);
    const res = await saveStoreDimensions(dcId, { length: l, width: w, height: h });
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "Failed to save dimensions.");
    } else {
      setSuccess("Dimensions saved successfully in MM.");
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Ruler className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Stores Material Dimensions (MM)
          </h2>
        </div>
        {isLocked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            <Lock className="h-3 w-3" /> Dimensions Locked ({status.replace(/_/g, " ")})
          </span>
        ) : canEditDimensions ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            Stores Entry Permitted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Pending Stores Entry
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          {success}
        </div>
      )}

      {!isLocked && canEditDimensions ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Enter outer material dimensions in millimeters (MM). Length, Width, and Height are required prior to Management Approval.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Length (L) — MM <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 100.00"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Width (W) — MM <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 50.00"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Height (H) — MM <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 25.00"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              {loading ? "Saving..." : "Save Stores Dimensions (MM)"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-3 gap-4 bg-slate-50 p-3 rounded-md text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Length (L)</span>
            <span className="font-bold text-slate-800">{initialLength != null ? `${initialLength} MM` : "—"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Width (W)</span>
            <span className="font-bold text-slate-800">{initialWidth != null ? `${initialWidth} MM` : "—"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Height (H)</span>
            <span className="font-bold text-slate-800">{initialHeight != null ? `${initialHeight} MM` : "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
