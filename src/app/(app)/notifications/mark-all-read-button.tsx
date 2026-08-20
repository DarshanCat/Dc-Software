"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markAllMyNotificationsRead } from "@/server/notifications/actions";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await markAllMyNotificationsRead();
    setBusy(false);
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={handleClick}>
      {busy ? "Marking…" : "Mark all read"}
    </Button>
  );
}