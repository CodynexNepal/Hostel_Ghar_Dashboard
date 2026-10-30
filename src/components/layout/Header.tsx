"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight, Crown, Menu, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, plan, subscriptionLoading, role } = useAuth();
  const { collapsed, toggleCollapsed, setMobileOpen } = useSidebar();
  const [showSearch, setShowSearch] = useState(false);
  const planLabel = plan ?? user?.subscription.plan ?? "FREE";
  const isOwner = role === "HOSTEL_OWNER" || user?.role === "HOSTEL_OWNER";
  return (
    <header className="z-40 shrink-0 border-b border-surface-border bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden rounded-md p-2 text-neutral-700 hover:bg-neutral-100 lg:inline-flex"
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight text-neutral-900 sm:text-xl">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden truncate text-[13px] text-neutral-500 sm:block">{subtitle}</p>
          )}
        </div>

        {/* Mobile Search Toggle */}
        <button
          onClick={() => setShowSearch((s) => !s)}
          aria-label="Search"
          className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 sm:hidden"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Global Desktop Search with Real Data & Keyboard Navigation */}
        <div className="hidden sm:block sm:w-64 lg:w-80">
          <GlobalSearch />
        </div>

        {/* Real-Time Notification Bell with Facebook-style Badges & Dropdown */}
        <NotificationBell />

        {user && (
          <div className="flex items-center gap-2">
            {isOwner && (
              <Link
                href="/subscription"
                title="View subscription"
                aria-label={`Current plan ${planLabel} — view subscription`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-brand-muted px-2.5 py-1 text-xs font-bold text-brand-ink transition-colors hover:bg-brand",
                  subscriptionLoading && "animate-pulse opacity-70"
                )}
              >
                <Crown className="h-3.5 w-3.5" aria-hidden />
                {subscriptionLoading ? "…" : planLabel}
              </Link>
            )}
            <span
              className="hidden h-9 w-9 items-center justify-center rounded-full bg-brand-ink text-xs font-bold text-brand md:flex"
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <span className="hidden min-w-0 leading-tight xl:block">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold text-neutral-900">
                {user.name}
              </span>
              <span className="block truncate text-xs text-neutral-500">{user.email}</span>
            </span>
          </div>
        )}
      </div>

      {/* Mobile Search Dropdown Form */}
      {showSearch && (
        <div className="border-t border-surface-border bg-neutral-50 px-4 py-2 sm:hidden">
          <GlobalSearch mobile onClose={() => setShowSearch(false)} />
        </div>
      )}
    </header>
  );
}
