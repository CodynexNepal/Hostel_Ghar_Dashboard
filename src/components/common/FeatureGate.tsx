"use client";

import { useUpgrade } from "@/hooks/useUpgrade";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/types/auth";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Central gate for plan-based features.
 * - Renders children normally when permitted.
 * - Otherwise renders a locked affordance that opens the upgrade modal.
 * Set `mode="hide"` only when you intentionally want to hide (rare).
 */
export function FeatureGate({
  permission,
  children,
  mode = "lock",
  className,
  fallback,
}: {
  permission: Permission;
  children: React.ReactNode;
  mode?: "lock" | "hide";
  className?: string;
  fallback?: React.ReactNode;
}) {
  const { canAccess } = usePermissions();
  const { openUpgrade } = useUpgrade();

  if (canAccess(permission)) return <>{children}</>;
  if (mode === "hide") return fallback ? <>{fallback}</> : null;

  return (
    <div className={cn("relative", className)}>
      <div aria-hidden className="pointer-events-none select-none opacity-50 grayscale-[0.2]">
        {children}
      </div>
      <button
        type="button"
        onClick={() => openUpgrade(permission)}
        className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-md bg-white/40 text-[13px] font-medium text-neutral-800 backdrop-blur-[1px] hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label="Locked feature — upgrade to unlock"
        title="Upgrade to unlock"
      >
        <Lock className="h-4 w-4" aria-hidden /> Locked
      </button>
    </div>
  );
}

/** Use on buttons/actions that must stay visible but locked. */
export function LockedAction({
  permission,
  children,
  onUnlocked,
  className,
}: {
  permission: Permission;
  children: React.ReactNode;
  onUnlocked?: () => void;
  className?: string;
}) {
  const { canAccess } = usePermissions();
  const { openUpgrade } = useUpgrade();
  const allowed = canAccess(permission);

  return (
    <span
      className={cn("relative inline-flex", className)}
      title={allowed ? undefined : "Upgrade to unlock"}
    >
      <span className={allowed ? "contents" : "pointer-events-none opacity-70"}>{children}</span>
      {!allowed && (
        <button
          type="button"
          aria-label="Locked — upgrade to unlock"
          onClick={() => openUpgrade(permission)}
          className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-neutral-900 p-1 text-white">
            <Lock className="h-3 w-3" aria-hidden />
          </span>
        </button>
      )}
      {allowed && onUnlocked ? null : null}
    </span>
  );
}
