"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestAmendment, approveAmendment, rejectAmendment } from "@/server/amendments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AmendmentItem {
  id: string;
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

export function AmendmentPanel({
  dcId,
  amendments,
  canRequest,
  canDecide,
}: {
  dcId: string;
  amendments: AmendmentItem[];
  canRequest: boolean;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const [newQuantity, setNewQuantity] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [reason, setReason] = useState("");

  const hasPending = amendments.some((a) => a.status === "PENDING");

  async function handleSubmitRequest() {
    setError(null);
    setBusy(true);
    const res = await requestAmendment({
      dcId,
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

  async function handleApprove(id: string) {
    setError(null);
    setBusy(true);
    const res = await approveAmendment(id);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function handleReject(id: string) {
    setError(null);
    const r = rejectReasons[id] || "";
    if (!r.trim()) {
      setError("Please explain why this amendment is rejected.");
      return;
    }
    setBusy(true);
    const res = await rejectAmendment(id, r);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Quantities & Weights Amendment</h2>

      {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}

      {canRequest && !hasPending && (
        <div className="space-y-3 rounded border border-slate-100 bg-slate-50 p-3 text-xs">
          <div className="font-medium text-slate-700">Request Correction / Amendment</div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="New Return FG Qty"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
            />
            <Input
              type="number"
              placeholder="New RM Qty (Weight)"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
            />
          </div>
          <Input
            placeholder="Reason for amendment (min 10 characters)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button size="sm" onClick={handleSubmitRequest} disabled={busy}>
            {busy ? "Submitting…" : "Submit Request"}
          </Button>
        </div>
      )}

      {amendments.length === 0 ? (
        <p className="text-xs text-slate-400">No amendment history for this DC.</p>
      ) : (
        <div className="space-y-3 text-xs">
          {amendments.map((a) => (
            <div key={a.id} className="rounded border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between text-slate-500 font-mono">
                <span>{a.requestedByName} · {new Date(a.requestedAt).toLocaleString()}</span>
                <span className={`font-semibold ${a.status === "PENDING" ? "text-amber-600" : a.status === "APPROVED" ? "text-emerald-600" : "text-rose-600"}`}>
                  {a.status}
                </span>
              </div>
              <p className="text-slate-800">Reason: {a.reason}</p>
              <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-slate-100 font-mono text-slate-700">
                <div>Return FG Qty: <span className="line-through text-slate-400">{a.previousQuantity}</span> → <span className="font-semibold text-emerald-700">{a.newQuantity}</span></div>
                <div>RM Weight: <span className="line-through text-slate-400">{a.previousWeight}</span> → <span className="font-semibold text-emerald-700">{a.newWeight}</span> kg</div>
              </div>
              {a.status === "PENDING" && canDecide && (
                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" onClick={() => handleApprove(a.id)} disabled={busy}>Approve Amendment</Button>
                  <Input
                    placeholder="Rejection reason…"
                    value={rejectReasons[a.id] || ""}
                    onChange={(e) => setRejectReasons({ ...rejectReasons, [a.id]: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" variant="secondary" onClick={() => handleReject(a.id)} disabled={busy}>Reject</Button>
                </div>
              )}
              {a.decisionReason && <p className="text-rose-600">Decision note: {a.decisionReason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}