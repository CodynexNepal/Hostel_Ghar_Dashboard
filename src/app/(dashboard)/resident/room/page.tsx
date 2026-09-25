"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";

export default function ResidentRoomPage() {
  const room = useMyRoomSummary();
  const resident = room.myRoom;
  const address = [resident?.hostel?.address, resident?.hostel?.city].filter(Boolean).join(", ");
  const rows: [string, string][] = resident
    ? [
        ["Resident", resident.fullName],
        ["Hostel", room.hostelName],
        ["Address", address || "-"],
        ["Room", resident.roomNumber || "-"],
        ["Bed", resident.bedNumber || "-"],
        ["Room type", resident.roomType ?? "-"],
        ["Floor / Flat", `Floor ${resident.floor || "-"} / Flat ${resident.flat || "-"}`],
        ["Monthly rent", resident.monthlyRent ? formatCurrency(resident.monthlyRent) : "-"],
        ["Joined", resident.joinedDate ? formatDate(resident.joinedDate) : "-"],
        ["Phone", resident.phone ?? "-"],
        ["Email", resident.email || "-"],
      ]
    : [];

  return (
    <DashboardShell title="My Room" subtitle={room.hostelName}>
      {room.isLoading ? (
        <Card className="p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
        </Card>
      ) : room.error && !resident ? (
        <ErrorState
          title="Couldn't load your room"
          description={room.error.message}
          onRetry={room.retry}
        />
      ) : !resident ? (
        <EmptyState
          title="Room not assigned"
          description="Your warden hasn't linked you to a room yet."
        />
      ) : (
        <Card>
          <CardHeader
            title={resident.fullName}
            subtitle={`Room ${resident.roomNumber || "-"} - Bed ${resident.bedNumber || "-"}`}
            action={<Badge tone="green">ACTIVE</Badge>}
          />
          <dl className="divide-y divide-neutral-100 px-5">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-neutral-500">{label}</dt>
                <dd className="text-right font-medium text-neutral-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </DashboardShell>
  );
}
