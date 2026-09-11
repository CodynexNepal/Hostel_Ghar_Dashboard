"use client";
import { useState } from "react";
import { Bell, ChevronsLeft, ChevronsRight, Crown, Menu, Search } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { initials } from "@/lib/utils";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  const { collapsed, toggleCollapsed, setMobileOpen } = useSidebar();
  const [showSearch, setShowSearch] = useState(false);
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
          <Breadcrumb />
          <h1 className="truncate text-lg font-bold leading-tight text-neutral-900 sm:text-xl">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden truncate text-[13px] text-neutral-500 sm:block">{subtitle}</p>
          )}
        </div>
        <button
          onClick={() => setShowSearch((s) => !s)}
          aria-label="Search"
          className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 sm:hidden"
        >
          <Search className="h-5 w-5" />
        </button>
        <div className="relative hidden sm:block sm:w-56 lg:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <input
            aria-label="Search"
            placeholder="Search residents, rooms…"
            className="h-10 w-full rounded-md border border-surface-border bg-surface-muted pl-9 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:border-brand-ink focus:bg-white"
          />
        </div>
        <button
          aria-label="Notifications, 3 unread"
          className="relative rounded-md p-2 text-neutral-600 hover:bg-neutral-100"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-ink text-[10px] font-bold text-brand">
            3
          </span>
        </button>
        {user && (
          <div className="hidden items-center gap-2 md:flex">
            <span className="hidden items-center gap-1 rounded-full bg-brand-muted px-2.5 py-1 text-xs font-bold text-brand-ink lg:inline-flex">
              <Crown className="h-3.5 w-3.5" />
              {user.subscription.plan}
            </span>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-ink text-xs font-bold text-brand"
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
      {showSearch && (
        <div className="border-t border-surface-border px-4 py-2 sm:hidden">
          <input
            aria-label="Search"
            autoFocus
            placeholder="Search residents, rooms…"
            className="h-10 w-full rounded-md border border-surface-border bg-surface-muted px-3 text-sm outline-none focus:border-brand-ink focus:bg-white"
          />
        </div>
      )}
    </header>
  );
}
