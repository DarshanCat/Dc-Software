import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { hasPermission } from "@/server/authorize";
import { PERMISSIONS } from "@/config/permissions";
import { SETTINGS_FIELDS } from "@/lib/validation/system-settings";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await getSessionUser();
  const canManage = user ? await hasPermission(user.id, PERMISSIONS.SYSTEM_SETTINGS) : false;

  if (!canManage) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
        You do not have permission to view system settings.
      </div>
    );
  }

  const rows = await prisma.systemSetting.findMany();
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">System Settings</h1>
        <p className="text-sm text-slate-500">
          Company and regional defaults. Currently used by future features (e.g. the DC PDF header) —
          the rest of the app does not yet read these values dynamically for display formatting.
        </p>
      </div>

      <SettingsForm fields={SETTINGS_FIELDS} values={values} />
    </div>
  );
}