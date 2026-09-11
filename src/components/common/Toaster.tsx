"use client";

import { useToast, TOAST_ICONS } from "@/hooks/useToast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const bar: Record<string, string> = {
  success: "bg-brand",
  error: "bg-red-500",
  info: "bg-neutral-900",
  warning: "bg-amber-400",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 right-4 z-[90] flex flex-col gap-2 sm:left-auto sm:right-6 sm:w-[360px]"
    >
      {toasts.map((t) => {
        const Icon = TOAST_ICONS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 overflow-hidden rounded-card border border-surface-border bg-white p-3.5 shadow-pop"
          >
            <span className={cn("mt-1 h-8 w-1 shrink-0 rounded-full", bar[t.kind])} aria-hidden />
            <Icon
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                t.kind === "error" ? "text-red-600" : "text-neutral-900"
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 truncate text-[13px] text-neutral-500">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
