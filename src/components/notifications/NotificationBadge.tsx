"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface NotificationBadgeProps {
  count: number;
  max?: 9 | 99;
  variant?: "solid" | "subtle" | "dot";
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
}

/**
 * Facebook Messenger-style Red Notification Badge
 *
 * Characteristics:
 * - Crisp red badge (#E41E3F or #EF4444) with pure white text
 * - Compact pill/circle with centered bold typography
 * - Formats 9+ or 99+ cleanly
 * - Completely hidden when count is 0
 * - Optional gentle ping/pulse animation when new notifications arrive
 */
export function NotificationBadge({
  count,
  max = 99,
  variant = "solid",
  size = "sm",
  className,
  animate = false,
}: NotificationBadgeProps) {
  if (!count || count <= 0) return null;

  const displayCount = count > max ? `${max}+` : `${count}`;

  if (variant === "dot") {
    return (
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {animate && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full bg-[#EF4444]", className)} />
      </span>
    );
  }

  // Size variations
  const sizeClasses = {
    sm: "h-[18px] min-w-[18px] px-1 text-[10px] font-bold",
    md: "h-5 min-w-5 px-1.5 text-[11px] font-bold",
    lg: "h-6 min-w-6 px-2 text-xs font-bold",
  };

  return (
    <span
      className={cn(
        "relative inline-flex select-none items-center justify-center rounded-full leading-none tracking-tight transition-transform duration-200",
        variant === "solid"
          ? "bg-[#EF4444] text-white shadow-sm ring-1 ring-white/10"
          : "bg-red-500/15 font-semibold text-red-500",
        sizeClasses[size],
        animate && "animate-bounce",
        className
      )}
      aria-label={`${count} unread notifications`}
    >
      {animate && (
        <span className="pointer-events-none absolute -inset-0.5 animate-pulse rounded-full bg-red-500 opacity-30" />
      )}
      <span className="relative z-10">{displayCount}</span>
    </span>
  );
}

export default NotificationBadge;
