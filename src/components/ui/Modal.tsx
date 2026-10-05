"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  labelledBy,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  labelledBy?: string;
  className?: string;
  /** sm = 448px, md = 560px, lg = 672px (for content-heavy dialogs like checkout). */
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy ?? "modal-title"}
    >
      <button
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/55"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          // Scroll-safe: never taller than viewport, body scrolls inside.
          "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop outline-none",
          "sm:max-h-[calc(100dvh-4rem)] sm:rounded-xl",
          size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
          "animate-[modal-in_180ms_ease-out]",
          className
        )}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-5 w-5" />
        </button>
        {title && (
          <h2
            id="modal-title"
            className="px-5 pr-12 pt-5 text-base font-semibold text-neutral-900 sm:px-6 sm:text-lg"
          >
            {title}
          </h2>
        )}
        {description && (
          <p className="px-5 pt-1 text-[13px] text-neutral-500 sm:px-6 sm:text-sm">{description}</p>
        )}
        <div className="dashboard-scroll mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
