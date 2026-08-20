"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestAmendment, approveAmendment, rejectAmendment } from "@/server/amendments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AmendmentItem {
  id: string;
  dcItemId: string;
  requestedByName: string;
  requestedAt: string;
  reason: string;
  previousQuantity: number;
  previousWeight: number;
  newQuantity: number;
  newWeight: number;
  status: string;
  decidedByName: string | null;
  decisionReason: string | null;
}

interface DcItemOption {
  id: string;
  label: string;
  quantity: number;
  weight: number;
}

export function AmendmentPanel({
  dcId,
  dcItems,
  amendments,
  canRequest,
  canDecide,
}: {
  dcId: string;
  dcItems: DcItemOption[];
  amendments: AmendmentItem[];
  canRequest: boolean;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const [selectedItemId, setSelectedItemId] = useState(dcItems[0]?.id ?? "");
  const [newQuantity, setNewQuantity] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [reason, setReason] = useState("");

  const pendingItemIds = new Set(amendments.filter((a) => a.status === "PENDING").map((a) => a.dcItemId));
  const requestableItems = dcItems.filter((it) => !pendingItemIds.has(it.id));

  async function handleSubmitRequest() {
    setError(null);
    if (!selectedItemId) {
      setError("Select an item.");
      return;
    }
    setBusy(true);
    const res = await requestAmendment({
      dcId,
      dcItemId: selectedItemId,
      newQuantity: Number(newQuantity),
      newWeight: Number(newWeight),
      reason,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNewQuantity("");
    setNewWeight("");
    setReason("");
    router.refresh();
  }

  async function handleApprove(amendmentId: string) {
    setBusy(true);
    const res = await approveAmendment(amendmentId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleReject(amendmentId: string) {
    const rejectReason = rejectReasons[amendmentId];
    if (!rejectReason || rejectReason.trim().length === 0) {
      setError("Enter a reason to reject this amendment.");
      return;
    }
    setBusy(true);
    const res = await rejectAmendment(amendmentId, rejectReason);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  if (amendments.length === 0 && !canRequest) return null;

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Amendments</h2>

      {amendments.length > 0 && (
        <div className="mb-4 space-y-3">
          {amendments.map((a) => (
            <div key={a.id} className="rounded-md border border-slate-100 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">
                  Qty {a.previousQuantity} → {a.newQuantity}, Weight {a.previousWeight.toFixed(3)} → {a.newWeight.toFixed(3)} kg
                </span>
                <span
                  className={
                    a.status === "PENDING"
                      ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                      : a.status === "APPROVED"
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                        : "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
                  }
                >
                  {a.status}
                </span>
              </div>
              <p className="mt-1 text-slate-600">{a.reason}</p>
              <p className="mt-1 text-xs text-slate-400">
                Requested by {a.requestedByName} on {new Date(a.requestedAt).toLocaleString()}
              </p>
              {a.decisionReason && <p className="mt-1 text-xs text-slate-500">Decision note: {a.decisionReason}</p>}

              {a.status === "PENDING" && canDecide && (
                <div className="mt-2 flex items-end gap-2">
                  <Button size="sm" disabled={busy} onClick={() => handleApprove(a.id)}>
                    Approve
                  </Button>
                  <div className="flex-1">
                    <Input
                      placeholder="Rejection reason"
                      value={rejectReasons[a.id] ?? ""}
                      onChange={(e) => setRejectReasons((r) => ({ ...r, [a.id]: e.target.value }))}
                    />
                  </div>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleReject(a.id)}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canRequest && requestableItems.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Request Amendment</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Item</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                {requestableItems.map((it) => (
                  <option key={it.id} value={it.id}>{it.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">New Quantity</label>
              <Input type="number" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">New Weight (kg)</label>
              <Input type="number" step="0.001" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Reason</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this correction needed?" />
            </div>
          </div>
          <div className="mt-3">
            <Button size="sm" disabled={busy} onClick={handleSubmitRequest}>
              {busy ? "Submitting…" : "Submit Amendment Request"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}