"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";
import { initials } from "@/lib/utils";

export default function ResidentProfilePage() {
  const { user } = useAuth();
  const room = useMyRoomSummary();
  const r = room.myRoom;
  const rows: [string, string][] = [
    ["Name", r?.fullName || user?.name || "—"],
    ["Email", r?.email || user?.email || "—"],
    ["Phone", r?.phone || user?.phone || "—"],
    ["Hostel", room.hostelName],
    ["Room", r ? `Room ${r.roomNumber} · Floor ${r.floor} · Flat ${r.flat}` : "Not assigned"],
    ["Bed", r?.bedNumber ?? "—"],
  ];
  return (
    <DashboardShell title="Profile" subtitle="GET /auth/me + your resident row">
      {room.isLoading ? (
        <Card className="p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
        </Card>
      ) : room.error && !r && !user ? (
        <ErrorState
          title="Couldn't load profile"
          description={room.error.message}
          onRetry={room.retry}
        />
      ) : (
        <Card>
          <CardHeader
            title={r?.fullName || user?.name || "Resident"}
            subtitle={r?.email || user?.email || ""}
            action={<Badge tone="green">RESIDENT</Badge>}
          />
          <div className="flex items-center gap-4 px-5 pt-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-lg font-bold text-white">
              {initials(r?.fullName || user?.name)}
            </div>
            <div>
              <p className="text-sm font-semibold">{room.hostelName}</p>
              <p className="text-[13px] text-neutral-500">{room.roomLabel}</p>
            </div>
          </div>
          <dl className="divide-y divide-neutral-100 px-5 py-2">
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
