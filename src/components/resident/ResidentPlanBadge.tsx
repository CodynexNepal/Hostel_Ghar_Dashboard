"use client";

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";
import { useHostelPlan } from "@/hooks/useHostelPlan";

/**
 * Read-only plan pill for residents — shows the hostel's live plan.
 * Rendered as a <span> on purpose: residents must never reach
 * the subscription management page (`/subscription` is owner-only).
 */
export function ResidentPlanBadge({ className }: { className?: string }) {
  const { hostelId, hostelName } = useMyRoomSummary();
  const { plan, isLoading } = useHostelPlan(hostelId);
  return (
    <span
      title={hostelName ? `${hostelName} plan` : "Hostel plan"}
      aria-label={`Hostel plan ${isLoading ? "loading" : plan}`}
      className={cn(
        "inline-flex cursor-default items-center gap-1 rounded-full bg-brand-muted px-2.5 py-1 text-xs font-bold text-brand-ink",
        isLoading && "animate-pulse opacity-70",
        className
      )}
    >
      <Crown className="h-3.5 w-3.5" aria-hidden />
      {isLoading ? "…" : plan}
    </span>
  );
}
