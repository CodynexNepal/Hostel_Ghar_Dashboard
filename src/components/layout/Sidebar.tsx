"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationForRole, homeRouteForRole } from "@/constants/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { SidebarNavList } from "./SidebarNav";
import { Skeleton } from "@/components/ui/Skeleton";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Hostel Ghar brand mark — official logo plus text fallback.
 * The JPG logo has a light background, so it sits in a white rounded tile
 * that reads cleanly on the dark sidebar.
 */
export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 overflow-hidden">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
        <Image
          src="/images/logo/hostel_ghar_logo.jpg"
          alt="Hostel Ghar"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
          priority
        />
      </span>
      {!collapsed && (
        <span className="sidebar-label whitespace-nowrap">
          <span className="block text-[15px] font-bold leading-tight text-white">Hostel Ghar</span>
         
        </span>
      )}
    </span>
  );
}

export function Sidebar() {
  const { user, isLoading } = useAuth();
  const { collapsed, setMobileOpen } = useSidebar();
  const pathname = usePathname() ?? "/";
  // While auth revalidates, show skeleton briefly — never stick on it.
  // If loading finished with no user (logged out / session expired),
  // fall back to URL-derived nav so /admin* still shows admin links
  // instead of an eternal skeleton while guards redirect.
  if (isLoading) {
    return (
      <aside
        aria-label="Primary"
        aria-busy
        className={cn(
          "hidden h-screen shrink-0 flex-col gap-2 bg-brand-ink p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex",
          collapsed ? "w-[76px]" : "w-[264px]"
        )}
      >
        <Skeleton className="h-9 w-9 rounded-lg bg-white/10" />
        <Skeleton className="h-10 w-full rounded-md bg-white/10" />
        <Skeleton className="h-10 w-full rounded-md bg-white/10" />
        <Skeleton className="h-10 w-full rounded-md bg-white/10" />
      </aside>
    );
  }
  if (!user) {
    const fallbackRole = pathname.startsWith("/admin")
      ? "SUPER_ADMIN"
      : pathname.startsWith("/resident")
        ? "RESIDENT"
        : "HOSTEL_OWNER";
    const nav = navigationForRole(fallbackRole);
    const home = homeRouteForRole(fallbackRole);
    return (
      <aside
        aria-label="Primary"
        className={cn(
          "hidden h-full shrink-0 flex-col self-stretch overflow-hidden bg-brand-ink text-neutral-200 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex",
          collapsed ? "w-[76px]" : "w-[264px]"
        )}
      >
        <Link
          href={home}
          className="flex h-16 shrink-0 items-center gap-2.5 overflow-hidden px-4"
          aria-label="Hostel Ghar home"
        >
          <BrandMark collapsed={collapsed} />
        </Link>
        <nav
          className="sidebar-nav min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 pb-4 pt-1"
          aria-label="Dashboard navigation"
        >
          <SidebarNavList nav={nav} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
        </nav>
      </aside>
    );
  }
  const nav = navigationForRole(user.role);
  const home = homeRouteForRole(user.role);
  const pct = Math.min(
    100,
    (user.subscription.residentsUsed / Math.max(1, user.subscription.residentsLimit)) * 100
  );
  return (
    <aside
      aria-label="Primary"
      className={cn(
        "hidden h-full shrink-0 flex-col self-stretch overflow-hidden bg-brand-ink text-neutral-200 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex",
        collapsed ? "w-[76px]" : "w-[264px]"
      )}
    >
      <Link
        href={home}
        className="flex h-16 shrink-0 items-center gap-2.5 overflow-hidden px-4"
        aria-label="Hostel Ghar home"
      >
        <BrandMark collapsed={collapsed} />
      </Link>
      <nav
        className="sidebar-nav min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 pb-4 pt-1"
        aria-label="Dashboard navigation"
      >
        <SidebarNavList nav={nav} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        {!collapsed ? (
          <Link
            href="/subscription"
            className="block rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Current plan
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-white">
              <span className="inline-block h-2 w-2 rounded-full bg-brand" />
              {user.subscription.plan}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              {user.subscription.residentsUsed} / {user.subscription.residentsLimit} residents
            </p>
          </Link>
        ) : (
          <Link
            href="/subscription"
            aria-label="View subscription"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-brand hover:bg-white/10"
          >
            {user.subscription.plan.slice(0, 2)}
          </Link>
        )}
        <div
          className={cn(
            "mt-2 flex items-center gap-2.5 rounded-lg p-1.5",
            collapsed && "justify-center"
          )}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-ink"
            aria-hidden
          >
            {initials(user.name)}
          </span>
          {!collapsed && (
            <span className="sidebar-label min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-white">
                {user.name}
              </span>
              <span className="block truncate text-xs text-neutral-400">
                {user.role === "HOSTEL_OWNER"
                  ? "Hostel Owner"
                  : user.role === "SUPER_ADMIN"
                    ? "Super Admin"
                    : "Resident"}
              </span>
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
