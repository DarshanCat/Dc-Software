"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustNumberSequence } from "@/server/numbering/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdjustSequenceForm({
  sequenceKey,
  fiscalYear,
  current,
}: {
  sequenceKey: string;
  fiscalYear: string;
  current: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const res = await adjustNumberSequence(sequenceKey, fiscalYear, Number(value));
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-20"
      />
      <Button size="sm" variant="secondary" disabled={busy} onClick={handleSave}>
        {busy ? "Saving…" : "Save"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}