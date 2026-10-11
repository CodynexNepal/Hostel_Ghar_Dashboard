"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Crown, Lock, LogOut, X } from "lucide-react";
import { useState } from "react";
import { navigationForRole } from "@/constants/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useSidebar } from "@/hooks/useSidebar";
import { useUpgrade } from "@/hooks/useUpgrade";
import { cn } from "@/lib/utils";

export function MobileSidebar() {
  const { user, isLoading, plan, subscriptionLoading, requestLogout } = useAuth();
  const { canAccess, isPlanLoading } = usePermissions();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const { openUpgrade } = useUpgrade();
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Hostel: true,
    Residents: true,
    Finance: true,
  });
  if (isLoading || subscriptionLoading) return null;
  // Same fallback as desktop Sidebar: derive role from URL when no session
  // so /admin* never shows an empty drawer while guards redirect.
  const fallbackRole = (pathname ?? "/").startsWith("/admin")
    ? "SUPER_ADMIN"
    : (pathname ?? "/").startsWith("/resident")
      ? "RESIDENT"
      : "HOSTEL_OWNER";
  const nav = navigationForRole(user?.role ?? fallbackRole);
  return (
    <div
      className={cn("fixed inset-0 z-[70] lg:hidden", mobileOpen ? "" : "pointer-events-none")}
      aria-hidden={!mobileOpen}
    >
      <div
        onClick={() => setMobileOpen(false)}
        className={cn(
          "absolute inset-0 bg-black/55 transition-opacity duration-200",
          mobileOpen ? "opacity-100" : "opacity-0"
        )}
      />
      <aside
        aria-label="Mobile navigation"
        className={cn(
          "absolute left-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col bg-brand-ink text-neutral-200 shadow-pop transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <span className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white">
              <Image
                src="/images/logo/hostel_ghar_logo.jpg"
                alt="Hostel Ghar"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
            </span>
            <span className="text-[15px] font-bold text-white">Hostel Ghar</span>
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 pb-4" aria-label="Mobile">
          <ul className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const allowed = isPlanLoading ? true : canAccess(item.permission);
              if (item.children?.length) {
                const open = openGroups[item.label] ?? true;
                return (
                  <li key={item.label}>
                    <button
                      onClick={() => setOpenGroups((g) => ({ ...g, [item.label]: !open }))}
                      aria-expanded={open}
                      className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-neutral-300 hover:bg-white/5"
                    >
                      <Icon className="h-[18px] w-[18px]" />{" "}
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform", open ? "" : "-rotate-90")}
                      />
                    </button>
                    {open && (
                      <ul className="ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                        {item.children.map((c) => {
                          const ok = isPlanLoading ? true : canAccess(c.permission);
                          if (!ok)
                            return (
                              <li key={c.label}>
                                <button
                                  onClick={() => {
                                    setMobileOpen(false);
                                    if (c.permission) openUpgrade(c.permission);
                                  }}
                                  className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] text-neutral-500"
                                >
                                  <span>{c.label}</span>
                                  <Lock className="h-3.5 w-3.5" />
                                </button>
                              </li>
                            );
                          return (
                            <li key={c.label}>
                              <Link
                                href={c.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "block truncate rounded-md px-2.5 py-2 text-[13px]",
                                  pathname === c.href
                                    ? "bg-brand font-semibold text-brand-ink"
                                    : "text-neutral-400"
                                )}
                              >
                                {c.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              }
              if (!allowed)
                return (
                  <li key={item.label}>
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        if (item.permission) openUpgrade(item.permission);
                      }}
                      className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-neutral-500"
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <Lock className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              return (
                <li key={item.label}>
                  <Link
                    href={item.href!}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
                      pathname === item.href
                        ? "bg-brand font-semibold text-brand-ink"
                        : "text-neutral-300"
                    )}
                  >
                    {" "}
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {user && (
          <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
            <div className="flex items-center gap-2.5 px-1">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-ink"
                aria-hidden
              >
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[13px] font-semibold text-white"
                  title={user.name}
                >
                  {user.name}
                </span>
                <span className="block truncate text-xs text-neutral-400" title={user.email}>
                  {user.email}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  requestLogout();
                }}
                aria-label="Log out"
                title="Log out"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
        {user?.role === "HOSTEL_OWNER" && (
          <div className="shrink-0 border-t border-white/10 p-3">
            <Link
              href="/subscription"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
              aria-label={`Current plan ${plan} — view subscription`}
            >
              <span>
                <span className="block text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  Current plan
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-white">
                  <Crown className="h-4 w-4 text-brand" aria-hidden />
                  {subscriptionLoading ? "…" : plan}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-400">
                  {user.subscription.residentsLimit == null ? (
                    <>
                      Unlimited residents
                      {user.subscription.residentsUsed > 0
                        ? ` · ${user.subscription.residentsUsed} in-house`
                        : ""}
                    </>
                  ) : (
                    <>
                      {user.subscription.residentsUsed} / {user.subscription.residentsLimit}{" "}
                      residents
                    </>
                  )}
                </span>
              </span>
              <span className="text-xs font-semibold text-brand">Manage</span>
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
