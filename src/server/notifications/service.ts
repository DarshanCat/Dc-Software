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
  targetUrl?: string;
}

export function getNotificationTargetUrl(notification: {
  entityType?: string | null;
  entityId?: string | null;
  targetUrl?: string | null;
}): string | null {
  if (notification.targetUrl) return notification.targetUrl;
  if (!notification.entityType) return null;

  const entityType = notification.entityType.toUpperCase();
  if (
    (entityType === "DELIVERYCHALLAN" ||
      entityType === "DELIVERY_CHALLAN" ||
      entityType === "DC") &&
    notification.entityId
  ) {
    return `/dcs/${notification.entityId}`;
  }
  if (
    (entityType === "REGISTRATIONREQUEST" ||
      entityType === "REGISTRATION_REQUEST") &&
    notification.entityId
  ) {
    return `/admin/users/requests`;
  }
  if (
    (entityType === "AMENDMENT" || entityType === "DCAMENDMENT") &&
    notification.entityId
  ) {
    return `/dcs/${notification.entityId}`;
  }
  if (
    (entityType === "RECEIPT" || entityType === "DELIVERYCHALLANRECEIPT") &&
    notification.entityId
  ) {
    return `/dcs/${notification.entityId}`;
  }
  return null;
}

export async function createNotification(tx: Tx, input: CreateNotificationInput) {
  const derivedTargetUrl =
    input.targetUrl ??
    getNotificationTargetUrl({
      entityType: input.entityType,
      entityId: input.entityId,
      targetUrl: input.targetUrl,
    }) ??
    null;

  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      targetUrl: derivedTargetUrl,
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