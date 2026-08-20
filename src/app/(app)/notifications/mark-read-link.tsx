"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markMyNotificationRead } from "@/server/notifications/actions";

export function MarkReadLink({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await markMyNotificationRead(notificationId);
    setBusy(false);
    router.refresh();
  }

  return (
    <button onClick={handleClick} disabled={busy} className="text-slate-500 hover:underline">
      {busy ? "…" : "Mark read"}
    </button>
  );
}