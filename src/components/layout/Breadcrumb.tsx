"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight, House } from "lucide-react";
import { homeRouteForRole } from "@/constants/navigation";
import { useAuth } from "@/hooks/useAuth";
import { titleFromSegment } from "@/lib/utils";

export function Breadcrumb() {
  const pathname = usePathname() ?? "/";
  const { role } = useAuth();
  const home = homeRouteForRole(role ?? "HOSTEL_OWNER");
  const segments = pathname.split("/").filter(Boolean);

  const items =
    segments.length === 0
      ? [{ label: "Dashboard", href: home, current: true }]
      : segments.map((seg, i) => ({
          label: titleFromSegment(decodeURIComponent(seg)),
          href: `/${segments.slice(0, i + 1).join("/")}`,
          current: i === segments.length - 1,
        }));

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-[13px]">
        <li className="flex shrink-0 items-center">
          <Link
            href={home}
            aria-label="Hostel Ghar home"
            className="flex items-center gap-1.5 text-neutral-400 transition-colors hover:text-neutral-900"
          >
            <House className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden font-medium md:inline">Hostel Ghar</span>
          </Link>
        </li>
        {items.map((item) => (
          <Fragment key={`${item.href}-${item.label}`}>
            <li aria-hidden className="shrink-0 text-neutral-300">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li className="min-w-0 last:shrink last:overflow-hidden">
              {item.current ? (
                <span aria-current="page" className="block truncate font-semibold text-neutral-900">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="block max-w-[110px] truncate text-neutral-500 transition-colors hover:text-neutral-900 sm:max-w-[160px]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
