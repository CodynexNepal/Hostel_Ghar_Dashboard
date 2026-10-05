"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export interface AdminAction {
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeTone?: "amber" | "green" | "gray" | "blue";
  accent: string;
}

const BADGE_TONES: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800",
  green: "bg-emerald-100 text-emerald-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-neutral-100 text-neutral-600",
};

/** Every admin capability — one tap from the dashboard. */
export function AdminActionsGrid({
  actions,
  isLoading,
}: {
  actions: AdminAction[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <Skeleton className="mt-1.5 h-3 w-full" />
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((a) => (
        <Link key={a.label} href={a.href} className="group">
          <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:border-brand-ink hover:shadow-pop">
            <span className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-white",
                  a.accent
                )}
              >
                <a.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              {a.badge && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    BADGE_TONES[a.badgeTone ?? "gray"]
                  )}
                >
                  {a.badge}
                </span>
              )}
            </span>
            <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-neutral-900">
              {a.label}
              <ArrowUpRight
                className="h-3.5 w-3.5 text-neutral-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-ink"
                aria-hidden
              />
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-neutral-500">{a.desc}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
