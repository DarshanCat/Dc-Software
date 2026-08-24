import { requireUser } from "@/server/session";
import { ChangePasswordForm } from "@/components/users/change-password-form";

export const metadata = { title: "Change Password — DC Material Management" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Change Password</h1>
        <p className="text-sm text-slate-500 mb-6">
          Account: <span className="font-semibold text-slate-800">{user.email}</span>
        </p>

        <ChangePasswordForm isForced={user.mustChangePassword} />
      </div>
    </div>
  );
}
