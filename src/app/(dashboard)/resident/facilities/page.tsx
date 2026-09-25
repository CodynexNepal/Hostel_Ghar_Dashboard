"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { useHostelFacilities } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";

export default function ResidentFacilitiesPage() {
  const room = useMyRoomSummary();
  const fac = useHostelFacilities(room.hostelId);
  return (
    <DashboardShell title="Facilities" subtitle={room.hostelName}>
      <Card>
        <CardHeader title="Hostel facilities" subtitle="Maintained by your hostel team" />
        {fac.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : fac.error ? (
          <div className="p-5">
            <ErrorState
              title="Couldn't load facilities"
              description={fac.error.message}
              onRetry={fac.retry}
            />
          </div>
        ) : (fac.data ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No facilities yet"
              description="Your hostel hasn't published facilities."
            />
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {(fac.data ?? []).map((f) => (
              <div key={f.id} className="rounded-lg border border-surface-border p-4">
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="min-w-0 truncate">{f.title}</span>
                  <Badge tone="gray" className="shrink-0">
                    {f.tag}
                  </Badge>
                </p>
                <p className="mt-1 text-[13px] text-neutral-500">{f.description || "—"}</p>
                {f.slug ? (
                  <p className="mt-2 text-xs text-neutral-400">
                    {f.slug}
                    {f.clientKey ? ` · ${f.clientKey}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
