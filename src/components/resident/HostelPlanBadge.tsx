"use client";
import { Crown } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useHostelPlan } from "@/hooks/useHostelPlan";

/**
 * Read-only hostel plan badge for residents.
 * Shows the LIVE plan of the resident's hostel via useHostelPlan
 * (subscription endpoint, then hostel record fallback). Never a link.
 */
export function HostelPlanBadge({
  hostelId,
  dark,
}: {
  hostelId?: string | null;
  /** Sidebar variant: light pill that reads on the dark sidebar surface. */
  dark?: boolean;
}) {
  const { plan, status, isLoading } = useHostelPlan(hostelId);

  if (isLoading) {
    return <Skeleton className="h-6 w-24 rounded-full" />;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={dark ? "green" : "dark"} className="gap-1">
        <Crown className="h-3.5 w-3.5" aria-hidden />
        {plan}
      </Badge>
      {status && (
        <Badge tone={statusTone(status)} className="uppercase">
          {status}
        </Badge>
      )}
      <span className="sr-only">of your hostel</span>
    </span>
  );
}
