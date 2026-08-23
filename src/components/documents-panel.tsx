"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument, deleteDocument } from "@/server/documents/actions";
import { Button } from "@/components/ui/button";

interface DocumentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedByName: string | null;
  uploadedAt: string;
}

export function DocumentsPanel({
  entityType,
  entityId,
  documents,
  canUpload,
  canDelete,
  revalidateTo,
}: {
  entityType: string;
  entityId: string;
  documents: DocumentItem[];
  canUpload: boolean;
  canDelete: boolean;
  revalidateTo: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setError(null);
    setBusy(true);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("entityType", entityType);
    formData.set("entityId", entityId);
    formData.set("revalidateTo", revalidateTo);

    const res = await uploadDocument(formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  async function handleDelete(documentId: string) {
    setBusy(true);
    await deleteDocument(documentId, revalidateTo);
    setBusy(false);
    router.refresh();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Documents</h2>

      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">No documents attached yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <a href={"/api/documents/" + d.id} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                  {d.fileName}
                </a>
                <p className="text-xs text-slate-400">
                  {d.fileType.toUpperCase()} · {formatSize(d.fileSize)} · {d.uploadedByName ?? "Unknown"} · {new Date(d.uploadedAt).toLocaleString()}
                </p>
              </div>
              {canDelete && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleDelete(d.id)}>
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.dwg,.dxf" className="text-sm" />
          <Button size="sm" disabled={busy} onClick={handleUpload}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}