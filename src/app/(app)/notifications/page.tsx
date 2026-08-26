import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { getNotificationTargetUrl } from "@/server/notifications/service";
import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationItemRow } from "./notification-item-row";

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

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden bg-white">
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet.</p>
        ) : (
          notifications.map((n) => {
            const targetUrl = getNotificationTargetUrl(n);
            return (
              <NotificationItemRow
                key={n.id}
                id={n.id}
                type={n.type}
                title={n.title}
                body={n.body}
                read={n.read}
                createdAtFormatted={n.createdAt.toLocaleString()}
                targetUrl={targetUrl}
              />
            );
          })
        )}
      </div>
    </div>
  );
}