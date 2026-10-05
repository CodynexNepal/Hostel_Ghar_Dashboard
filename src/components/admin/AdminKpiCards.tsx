"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export interface AdminKpi {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent: string;
  delta?: string;
  deltaUp?: boolean;
}

export function AdminKpiCards({ kpis, isLoading }: { kpis: AdminKpi[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-4 sm:p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-28" />
            <Skeleton className="mt-1.5 h-3 w-32" />
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => (
        <Card key={k.label} className="relative overflow-hidden p-4 sm:p-5">
          <span
            className={cn("pointer-events-none absolute inset-y-0 left-0 w-1", k.accent)}
            aria-hidden
          />
          <span className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-neutral-500">{k.label}</p>
            <k.icon className="h-4 w-4 text-neutral-400" aria-hidden />
          </span>
          <p
            className="mt-1 truncate text-xl font-bold text-neutral-900 sm:text-2xl"
            title={k.value}
          >
            {k.value}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-400">
            {k.hint && <span className="truncate">{k.hint}</span>}
            {k.delta && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                  k.deltaUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                )}
              >
                {k.deltaUp ? (
                  <TrendingUp className="h-3 w-3" aria-hidden />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden />
                )}
                {k.delta}
              </span>
            )}
          </p>
        </Card>
      ))}
    </div>
  );
}
