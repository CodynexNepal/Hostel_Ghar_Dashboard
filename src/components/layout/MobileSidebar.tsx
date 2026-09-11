"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock, X } from "lucide-react";
import { useState } from "react";
import { navigationForRole } from "@/constants/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useSidebar } from "@/hooks/useSidebar";
import { useUpgrade } from "@/hooks/useUpgrade";
import { cn } from "@/lib/utils";

export function MobileSidebar() {
  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const { openUpgrade } = useUpgrade();
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Hostel: true,
    Residents: true,
    Finance: true,
  });
  if (!user) return null;
  const nav = navigationForRole(user.role);
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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-extrabold text-brand-ink">
              HG
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
              const allowed = canAccess(item.permission);
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
                          const ok = canAccess(c.permission);
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
      </aside>
    </div>
  );
}
