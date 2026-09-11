"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { groupsForPath, isActivePath } from "@/constants/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { useUpgrade } from "@/hooks/useUpgrade";
import type { NavItem } from "@/constants/navigation";
import { cn } from "@/lib/utils";

export function SidebarNavList({
  nav,
  collapsed,
  onNavigate,
}: {
  nav: NavItem[];
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const { canAccess } = usePermissions();
  const { openUpgrade } = useUpgrade();
  const pathname = usePathname() ?? "/";
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [auto, setAuto] = useState<string[]>(() => groupsForPath(nav, pathname));

  useEffect(() => {
    setAuto(groupsForPath(nav, pathname));
  }, [nav, pathname]);

  function isOpen(label: string): boolean {
    if (manual[label] !== undefined) return manual[label];
    if (auto.includes(label)) return true;
    return true;
  }
  return (
    <ul className="space-y-1">
      {nav.map((item) => {
        const Icon = item.icon;
        const allowed = canAccess(item.permission);
        const hasKids = Boolean(item.children?.length);
        const active = item.href
          ? isActivePath(pathname, item.href)
          : (item.children?.some((c) => isActivePath(pathname, c.href)) ?? false);
        const tip = (
          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity group-hover:flex group-hover:opacity-100">
            {item.label}
            {!allowed && <Lock className="h-3 w-3" />}
          </span>
        );
        if (hasKids) {
          const open = collapsed ? false : isOpen(item.label);
          return (
            <li key={item.label}>
              <button
                onClick={() => setManual((m) => ({ ...m, [item.label]: !isOpen(item.label) }))}
                aria-expanded={open}
                className={cn(
                  "group relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {!collapsed && (
                  <>
                    <span className="sidebar-label flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        open ? "" : "-rotate-90"
                      )}
                    />
                  </>
                )}
                {collapsed && tip}
              </button>
              {!collapsed && open && (
                <ul className="ml-5 mt-1 animate-[fade-slide-in_180ms_ease-out] space-y-0.5 border-l border-white/10 pl-3">
                  {item.children!.map((child) => {
                    const ok = canAccess(child.permission);
                    if (!ok)
                      return (
                        <li key={child.label}>
                          <button
                            onClick={() => child.permission && openUpgrade(child.permission)}
                            title="Upgrade to unlock"
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
                          >
                            <span className="truncate">{child.label}</span>
                            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </button>
                        </li>
                      );
                    const cActive = isActivePath(pathname, child.href);
                    return (
                      <li key={child.label}>
                        <Link
                          href={child.href}
                          onClick={onNavigate}
                          aria-current={cActive ? "page" : undefined}
                          className={cn(
                            "block truncate rounded-md px-2.5 py-2 text-[13px] transition-colors",
                            cActive
                              ? "bg-brand font-semibold text-brand-ink"
                              : "text-neutral-400 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        }
        if (!allowed) {
          return (
            <li key={item.label}>
              <button
                onClick={() => item.permission && openUpgrade(item.permission)}
                title="Upgrade to unlock"
                className={cn(
                  "group relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-neutral-500 hover:bg-white/5 hover:text-neutral-200",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {!collapsed && (
                  <>
                    <span className="sidebar-label flex-1 text-left">{item.label}</span>
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                  </>
                )}
                {collapsed && tip}
              </button>
            </li>
          );
        }
        return (
          <li key={item.label}>
            <Link
              href={item.href!}
              onClick={onNavigate}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn(
                "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                item.href && isActivePath(pathname, item.href)
                  ? "bg-brand font-semibold text-brand-ink"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && <span className="sidebar-label flex-1 truncate">{item.label}</span>}
              {collapsed && tip}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
