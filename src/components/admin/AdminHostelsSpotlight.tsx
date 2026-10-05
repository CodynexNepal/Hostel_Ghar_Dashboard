"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import type { Hostel } from "@/types/hostel";
import { initials } from "@/lib/utils";

export function AdminHostelsSpotlight({
  hostels,
  isLoading,
  error,
  onRetry,
}: {
  hostels: Hostel[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Hostels spotlight"
        subtitle="Latest hostels on the platform"
        action={
          <Link href="/admin/hostels">
            <Button size="sm" variant="outline">
              Manage hostels
            </Button>
          </Link>
        }
      />
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <div className="p-5">
          <ErrorState title="Couldn't load hostels" description={error} onRetry={onRetry} />
        </div>
      ) : hostels.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No hostels yet"
            description="Create the first hostel to onboard an owner."
            action={
              <Link href="/admin/hostels">
                <Button size="sm">Create hostel</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {hostels.slice(0, 6).map((h) => (
            <li key={h.id}>
              <Link
                href="/admin/hostels"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/60 sm:px-5"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-ink text-xs font-bold text-brand"
                  aria-hidden
                >
                  {initials(h.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900">
                    {h.name}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {[h.city, h.ownerName ?? "No owner"].filter(Boolean).join(" · ")}
                    {typeof h.occupiedBeds === "number" ? ` · ${h.occupiedBeds} beds used` : ""}
                  </span>
                </span>
                <Badge tone={statusTone(String(h.status ?? ""))}>{h.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hostels.length > 0 && (
        <p className="flex items-center gap-1.5 border-t border-surface-border px-4 py-2.5 text-[11px] text-neutral-400 sm:px-5">
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          Suspending a hostel blocks owner logins — backend enforces authorization.
        </p>
      )}
    </Card>
  );
}
