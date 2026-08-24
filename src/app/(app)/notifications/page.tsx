import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { MarkAllReadButton } from "./mark-all-read-button";
import { MarkReadLink } from "./mark-read-link";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) {
    return <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">Not signed in.</div>;
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">{unreadCount} unread of {notifications.length}</p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet.</p>
        ) : (
          notifications.map((n) => {
            const href = n.entityType === "DeliveryChallan" && n.entityId ? "/dcs/" + n.entityId : null;
            return (
              <div key={n.id} className={"px-4 py-3 " + (n.read ? "" : "bg-blue-50")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-600">{n.type}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">{n.createdAt.toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    {href && (
                      <Link href={href} className="text-blue-700 hover:underline">
                        Open
                      </Link>
                    )}
                    {!n.read && <MarkReadLink notificationId={n.id} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}