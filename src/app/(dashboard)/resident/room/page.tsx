"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";

export default function ResidentRoomPage() {
  const room = useMyRoomSummary();
  const r = room.myRoom;
  const rows: [string, string][] = r
    ? [
        ["Hostel", room.hostelName],
        ["Room", `${r.roomNumber || "—"} · Floor ${r.floor} · Flat ${r.flat}`],
        ["Bed", r.bedNumber || "—"],
        ["Room type", r.roomType ?? "—"],
        ["Rent", r.monthlyRent ? formatCurrency(r.monthlyRent) : "—"],
      ]
    : [];
  return (
    <DashboardShell title="My Room" subtitle="GET /hostels/:id/residents → your row">
      {room.isLoading ? (
        <Card className="p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
        </Card>
      ) : room.error && !r ? (
        <ErrorState
          title="Couldn't load your room"
          description={room.error.message}
          onRetry={room.retry}
        />
      ) : !r ? (
        <EmptyState
          title="Room not assigned"
          description="Your warden hasn't linked you to a room yet, or this login can't read GET /hostels/:id/residents (admin/owner only)."
        />
      ) : (
        <Card>
          <CardHeader
            title={`Room ${r.roomNumber}`}
            subtitle={`Floor ${r.floor} · Flat ${r.flat} · Bed ${r.bedNumber}`}
            action={<Badge tone="green">ACTIVE</Badge>}
          />
          <dl className="divide-y divide-neutral-100 px-5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right font-medium text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </DashboardShell>
  );
}
