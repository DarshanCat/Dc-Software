"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { markMyNotificationRead } from "@/server/notifications/actions";
import { MarkReadLink } from "./mark-read-link";

interface NotificationRowProps {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAtFormatted: string;
  targetUrl: string | null;
}

export function NotificationItemRow({
  id,
  type,
  title,
  body,
  read,
  createdAtFormatted,
  targetUrl,
}: NotificationRowProps) {
  const router = useRouter();

  async function handleClick() {
    if (!read) {
      await markMyNotificationRead(id);
    }
    if (targetUrl) {
      router.push(targetUrl);
    }
  }

  const content = (
    <div
      onClick={handleClick}
      className={`px-4 py-3 cursor-pointer transition-colors ${
        read ? "hover:bg-slate-50" : "bg-blue-50/70 hover:bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
              {type}
            </span>
            {!read && <span className="h-2 w-2 rounded-full bg-blue-600" />}
          </div>
          <p className="mt-1 text-sm font-medium text-slate-900">{title}</p>
          {body && <p className="mt-0.5 text-sm text-slate-600">{body}</p>}
          <p className="mt-1 text-xs text-slate-400">{createdAtFormatted}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs shrink-0" onClick={(e) => e.stopPropagation()}>
          {targetUrl && (
            <Link
              href={targetUrl}
              onClick={async () => {
                if (!read) await markMyNotificationRead(id);
              }}
              className="text-blue-700 hover:underline font-medium"
            >
              Open
            </Link>
          )}
          {!read && <MarkReadLink notificationId={id} />}
        </div>
      </div>
    </div>
  );

  return content;
}
