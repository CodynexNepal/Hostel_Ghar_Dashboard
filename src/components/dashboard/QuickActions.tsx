"use client";
import Link from "next/link";
import { BedDouble, FileText, Lock, Receipt, Users, Wallet } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { usePermissions } from "@/hooks/usePermissions";
import { useUpgrade } from "@/hooks/useUpgrade";
import type { Permission } from "@/types/auth";
import { cn } from "@/lib/utils";

const ACTIONS: {
  label: string;
  desc: string;
  href: string;
  icon: typeof Users;
  permission?: Permission;
}[] = [
  {
    label: "Add Resident",
    desc: "Onboard a new resident",
    href: "/residents/add",
    icon: Users,
    permission: "ADD_RESIDENT",
  },
  {
    label: "Add Room",
    desc: "Create a room",
    href: "/rooms",
    icon: BedDouble,
    permission: "MANAGE_ROOMS",
  },
  {
    label: "Record Payment",
    desc: "Log rent collection",
    href: "/payments",
    icon: Wallet,
    permission: "MANAGE_PAYMENTS",
  },
  { label: "View Residents", desc: "Browse all residents", href: "/residents", icon: Users },
  { label: "View Rooms", desc: "Check occupancy", href: "/rooms", icon: BedDouble },
  {
    label: "Generate Report",
    desc: "Occupancy & revenue",
    href: "/reports",
    icon: FileText,
    permission: "VIEW_REPORTS",
  },
];

export function QuickActions() {
  const { canAccess } = usePermissions();
  const { openUpgrade } = useUpgrade();
  return (
    <Card>
      <CardHeader
        title="Quick Actions"
        subtitle="Frequent tasks — locked items open an upgrade prompt."
      />
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
        {ACTIONS.map((a) => {
          const locked = !canAccess(a.permission);
          const inner = (
            <>
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg",
                  locked ? "bg-neutral-100" : "bg-brand"
                )}
              >
                <a.icon className="h-[18px] w-[18px] text-brand-ink" aria-hidden />
              </span>
              <span className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-neutral-900">
                {a.label}
                {locked && <Lock className="h-3.5 w-3.5 text-neutral-400" aria-hidden />}
              </span>
              <span className="text-xs text-neutral-500">{locked ? "Upgrade to Pro" : a.desc}</span>
            </>
          );
          if (locked) {
            return (
              <button
                key={a.label}
                onClick={() => a.permission && openUpgrade(a.permission)}
                title="Upgrade to unlock"
                className="flex flex-col items-start rounded-lg border border-dashed border-surface-border bg-surface-muted/50 p-3.5 text-left transition-colors hover:border-neutral-300 hover:bg-surface-muted"
              >
                {inner}
              </button>
            );
          }
          return (
            <Link
              key={a.label}
              href={a.href}
              className="flex flex-col items-start rounded-lg border border-surface-border bg-white p-3.5 text-left transition-colors hover:border-brand-ink"
            >
              {inner}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 border-t border-surface-border px-5 py-3 text-xs text-neutral-500">
        <Receipt className="h-3.5 w-3.5" /> Frontend gating is UX-only; backend enforces
        authorization.
      </div>
    </Card>
  );
}
