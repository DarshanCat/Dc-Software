"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { markNotificationRead, markAllNotificationsRead, getNotificationTargetUrl } from "@/server/notifications/service";

export async function getMyNotificationSummary() {
  const user = await getSessionUser();
  if (!user)
    return {
      unreadCount: 0,
      recent: [] as {
        id: string;
        type: string;
        title: string;
        body: string | null;
        read: boolean;
        createdAt: string;
        entityType: string | null;
        entityId: string | null;
        targetUrl: string | null;
      }[],
    };

  const [unreadCount, recent] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    unreadCount,
    recent: recent.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      entityType: n.entityType,
      entityId: n.entityId,
      targetUrl: getNotificationTargetUrl(n),
    })),
  };
}

export async function markMyNotificationRead(notificationId: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const };
  await markNotificationRead(user.id, notificationId);
  revalidatePath("/notifications");
  return { ok: true as const };
}

export async function markAllMyNotificationsRead() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const };
  await markAllNotificationsRead(user.id);
  revalidatePath("/notifications");
  return { ok: true as const };
}