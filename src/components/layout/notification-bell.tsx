"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  getMyNotificationSummary,
  markMyNotificationRead,
  markAllMyNotificationsRead,
} from "@/server/notifications/actions";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  entityType: string | null;
  entityId: string | null;
}

function entityHref(item: NotificationItem): string | null {
  if (item.entityType === "DeliveryChallan" && item.entityId) return "/dcs/" + item.entityId;
  return null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const summary = await getMyNotificationSummary();
    setUnreadCount(summary.unreadCount);
    setRecent(summary.recent);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleItemClick(item: NotificationItem) {
    if (!item.read) {
      await markMyNotificationRead(item.id);
      refresh();
    }
  }

  async function handleMarkAll() {
    await markAllMyNotificationsRead();
    refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-blue-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              recent.map((item) => {
                const href = entityHref(item);
                const content = (
                  <div className={"px-3 py-2 text-sm " + (item.read ? "" : "bg-blue-50")}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-900">{item.title}</span>
                      {!item.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                    </div>
                    {item.body && <p className="mt-0.5 text-xs text-slate-500">{item.body}</p>}
                    <p className="mt-1 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                );
                return href ? (
                  <Link key={item.id} href={href} onClick={() => handleItemClick(item)} className="block border-b border-slate-50 hover:bg-slate-50">
                    {content}
                  </Link>
                ) : (
                  <div key={item.id} onClick={() => handleItemClick(item)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                    {content}
                  </div>
                );
              })
            )}
          </div>
          <Link href="/notifications" className="block px-3 py-2 text-center text-xs text-blue-700 hover:underline">
            View all
          </Link>
        </div>
      )}
    </div>
  );
}