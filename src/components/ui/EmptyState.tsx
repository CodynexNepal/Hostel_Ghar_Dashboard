"use client";

import { AlertTriangle, Inbox, Lock } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: "inbox" | "lock" | "alert";
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const Icon = icon === "lock" ? Lock : icon === "alert" ? AlertTriangle : Inbox;
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-surface-border bg-white px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
        <Icon className="h-6 w-6 text-neutral-500" aria-hidden />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong.",
  description = "We couldn't load this data. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-surface-border bg-white px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
      {onRetry && (
        <Button variant="dark" className="mt-5" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
