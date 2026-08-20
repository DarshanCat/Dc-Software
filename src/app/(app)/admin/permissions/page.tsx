import { redirect } from "next/navigation";

// Permissions are shown as part of each role's card on the Roles page —
// no separate view needed. Redirect here so the nav link isn't a dead end.
export default function PermissionsRedirectPage() {
  redirect("/admin/roles");
}