"use client";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  title,
  value,
  delta,
  deltaUp,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  delta: string;
  deltaUp?: boolean;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-neutral-700">{title}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted">
          <Icon className="h-[18px] w-[18px] text-neutral-900" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">{value}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold",
            deltaUp ? "bg-brand-muted text-brand-ink" : "bg-neutral-200 text-neutral-800"
          )}
        >
          {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta}
        </span>
        <span className="font-medium text-neutral-600">{hint}</span>
      </p>
    </Card>
  );
}
