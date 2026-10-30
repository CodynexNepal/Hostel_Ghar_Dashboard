"use client";

import React, { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { NotificationBadge } from "./NotificationBadge";
import { NotificationDropdown } from "./NotificationDropdown";
import { cn } from "@/lib/utils";

export function NotificationBell({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { totalUnread, hasNewAlert } = useNotifications();

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={`Notifications, ${totalUnread} unread`}
        aria-expanded={isOpen}
        className={cn(
          "relative rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-ink/20",
          isOpen && "bg-neutral-100 text-neutral-900"
        )}
      >
        <Bell className="h-5 w-5" />

        {/* Facebook-style Red Badge Indicator */}
        {totalUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5">
            <NotificationBadge count={totalUnread} max={99} size="sm" animate={hasNewAlert} />
          </span>
        )}
      </button>

      {/* Floating Center Dropdown */}
      <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

export default NotificationBell;
