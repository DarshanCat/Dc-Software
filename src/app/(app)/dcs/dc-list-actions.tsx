"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteDraftDc } from "@/server/dcs/extended-actions";
import { Button } from "@/components/ui/button";

interface Props {
  dcId: string;
  dcNumber: string;
  status: string;
  canEdit: boolean;
}

export function DcListRowActions({ dcId, dcNumber, status, canEdit }: Props) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = status === "DRAFT" || status === "SENT_BACK";

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/dcs/${dcId}`}
        className="text-xs font-semibold text-blue-700 hover:underline"
      >
        View
      </Link>

      {isDraft && canEdit && (
        <>
          <Link
            href={`/dcs/${dcId}/edit`}
            className="text-xs font-semibold text-slate-700 hover:underline"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Delete
          </button>
        </>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans text-left">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-red-700 border-b pb-2">Delete Draft DC?</h3>
            {error && (
              <div className="p-2 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
                {error}
              </div>
            )}
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                DC Number: <span className="font-mono">{dcNumber}</span>
              </p>
              <p className="text-slate-600 bg-red-50 border border-red-200 p-3 rounded-md text-xs font-medium">
                This action will permanently delete this Draft DC and cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" disabled={busy} onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const res = await deleteDraftDc(dcId);
                  setBusy(false);
                  if (!res.ok) {
                    setError(res.error || "Failed to delete Draft DC.");
                  } else {
                    setShowDeleteModal(false);
                    router.refresh();
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {busy ? "Deleting..." : "Delete Draft"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
