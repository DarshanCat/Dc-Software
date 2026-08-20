import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

export async function createNotification(tx: Tx, input: CreateNotificationInput) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });
}

export async function notifyUsersWithPermission(
  tx: Tx,
  permissionKey: string,
  notification: Omit<CreateNotificationInput, "userId">,
  excludeUserId?: string,
) {
  const users = await tx.user.findMany({
    where: {
      active: true,
      id: excludeUserId ? { not: excludeUserId } : undefined,
      roles: {
        some: {
          role: {
            permissions: {
              some: { permission: { key: permissionKey } },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  for (const user of users) {
    await createNotification(tx, { ...notification, userId: user.id });
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}