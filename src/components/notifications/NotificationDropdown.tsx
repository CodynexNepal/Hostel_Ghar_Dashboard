"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  CalendarCheck2,
  Users,
  CreditCard,
  Building2,
  MessageSquare,
  Utensils,
  Megaphone,
  AlertCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/api-types";

function getNotificationIcon(type: string, entityType: string) {
  const norm = (type + " " + entityType).toLowerCase();
  if (norm.includes("booking")) return <CalendarCheck2 className="h-4 w-4 text-emerald-400" />;
  if (norm.includes("resident")) return <Users className="h-4 w-4 text-blue-400" />;
  if (norm.includes("payment") || norm.includes("fee"))
    return <CreditCard className="h-4 w-4 text-[#C3FF7D]" />;
  if (norm.includes("hostel")) return <Building2 className="h-4 w-4 text-amber-400" />;
  if (norm.includes("meal")) return <Utensils className="h-4 w-4 text-orange-400" />;
  if (norm.includes("complaint")) return <MessageSquare className="h-4 w-4 text-rose-400" />;
  if (norm.includes("announcement")) return <Megaphone className="h-4 w-4 text-purple-400" />;
  return <AlertCircle className="h-4 w-4 text-neutral-400" />;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function NotificationDropdown({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { notifications, totalUnread, isLoading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();

  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (!isOpen) return null;

  const displayList = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    onClose();
    if (notif.targetUrl) {
      router.push(notif.targetUrl);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Dropdown Panel */}
      <div
        className={cn(
          "absolute right-0 top-full z-50 mt-2 w-80 animate-[fade-slide-in_150ms_ease-out] overflow-hidden rounded-xl border border-neutral-800 bg-[#0A0A0A] text-neutral-100 shadow-2xl ring-1 ring-white/10 sm:w-96"
        )}
        role="dialog"
        aria-label="Notifications center"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800/80 bg-neutral-900/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-white">Notifications</h2>
            {totalUnread > 0 && (
              <span className="flex items-center justify-center rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          {totalUnread > 0 && (
            <button
              onClick={() => markAllAsRead()}
              title="Mark all notifications as read"
              className="flex items-center gap-1 text-xs font-medium text-neutral-400 transition-colors hover:text-[#C3FF7D]"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 border-b border-neutral-800/50 bg-[#0c0c0c] px-3 py-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              filter === "all"
                ? "bg-white/10 text-white"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              filter === "unread"
                ? "bg-white/10 text-white"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
            )}
          >
            Unread ({totalUnread})
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] divide-y divide-neutral-800/50 overflow-y-auto overscroll-contain">
          {isLoading && displayList.length === 0 ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex animate-pulse gap-3">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-800" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-neutral-800" />
                    <div className="h-2.5 w-1/2 rounded bg-neutral-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayList.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-500">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-neutral-300">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                We will notify you immediately when important activities occur.
              </p>
            </div>
          ) : (
            displayList.map((notif) => {
              const icon = getNotificationIcon(notif.type, notif.entityType);
              const time = formatRelativeTime(notif.createdAt);

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "group relative flex cursor-pointer items-start gap-3 p-3.5 transition-colors",
                    notif.isRead
                      ? "text-neutral-300 hover:bg-neutral-900/50"
                      : "bg-[#141414] text-white hover:bg-[#1a1a1a]"
                  )}
                >
                  {/* Status Indicator Dot */}
                  {!notif.isRead && (
                    <span className="absolute left-1.5 top-5 h-2 w-2 rounded-full bg-[#EF4444]" />
                  )}

                  {/* Icon Avatar */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-800/80 bg-neutral-900">
                    {icon}
                  </div>

                  {/* Notification Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <p
                        className={cn(
                          "line-clamp-1 text-xs font-semibold leading-snug",
                          notif.isRead ? "text-neutral-300" : "text-white"
                        )}
                      >
                        {notif.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-neutral-500">{time}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                      {notif.message}
                    </p>
                  </div>

                  {/* Quick Actions (visible on hover) */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                        title="Mark as read"
                        className="rounded p-1 text-neutral-400 hover:bg-white/10 hover:text-[#C3FF7D]"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      title="Delete notification"
                      className="rounded p-1 text-neutral-500 hover:bg-white/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {displayList.length > 0 && (
          <div className="border-t border-neutral-800/80 bg-neutral-900/50 px-4 py-2.5 text-center">
            <span className="text-[11px] font-medium text-neutral-400">
              Hostel Ghar Real-Time Activity Tracking
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export default NotificationDropdown;
