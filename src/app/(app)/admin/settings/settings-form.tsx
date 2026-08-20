"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSystemSettings } from "@/server/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SystemSettingsInput } from "@/lib/validation/system-settings";

interface Field {
  key: keyof SystemSettingsInput;
  label: string;
  group: string;
}

export function SettingsForm({ fields, values }: { fields: Field[]; values: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(values);

  const groups = Array.from(new Set(fields.map((f) => f.group)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    const res = await saveSystemSettings(draft as SystemSettingsInput);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {groups.map((group) => (
        <div key={group} className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{group}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {fields
              .filter((f) => f.group === group)
              .map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{f.label}</label>
                  <Input
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">Settings saved.</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save Settings"}
      </Button>
    </form>
  );
}