"use client";
import { Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { env } from "@/lib/env";

export function RoleSwitcher() {
  const { role, plan, switchRole, switchPlan } = useAuth();
  if (env.isProd) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-card border border-surface-border bg-white px-4 py-3 text-[13px]"
      role="group"
      aria-label="Dev role and plan switcher"
    >
      <span className="font-semibold text-neutral-700">Dev preview:</span>
      {(["HOSTEL_OWNER", "RESIDENT", "SUPER_ADMIN"] as const).map((r) => (
        <button
          key={r}
          onClick={() => switchRole(r)}
          aria-pressed={role === r}
          className={
            role === r
              ? "rounded-full bg-brand-ink px-3 py-1 font-semibold text-brand"
              : "rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-600 hover:bg-neutral-200"
          }
        >
          {r === "HOSTEL_OWNER" ? "Owner" : r === "RESIDENT" ? "Resident" : "Super Admin"}
        </button>
      ))}
      <span className="mx-1 hidden h-4 w-px bg-neutral-200 sm:block" aria-hidden />
      <Crown className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
      {(["FREE", "BASIC", "PRO", "ENTERPRISE"] as const).map((p) => (
        <button
          key={p}
          onClick={() => switchPlan(p)}
          aria-pressed={plan === p}
          className={
            plan === p
              ? "rounded-full bg-brand px-3 py-1 font-bold text-brand-ink"
              : "rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-600 hover:bg-neutral-200"
          }
        >
          {p}
        </button>
      ))}
      <Link href="/subscription" className="ml-auto hidden sm:block">
        <Button variant="ghost" size="sm">
          Manage plan
        </Button>
      </Link>
    </div>
  );
}
