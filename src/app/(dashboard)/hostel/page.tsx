"use client";
import { MapPin, Phone, Mail, Wifi, Droplets, Zap, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { hostelGhar, toPaginated, unwrap } from "@/lib/hostelGhar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import type { HostelDetail, OwnerDashboard } from "@/lib/api-types";

const FACILITIES = [
  { icon: Wifi, label: "High-speed WiFi", desc: "Fibre on every floor" },
  { icon: Droplets, label: "Hot water", desc: "Solar + backup" },
  { icon: Zap, label: "Power backup", desc: "Inverter + generator" },
  { icon: ShieldCheck, label: "CCTV & warden", desc: "24/7 security" },
];

export default function HostelOverviewPage() {
  const { user } = useAuth();
  const { data, error, isLoading, retry } = useApi(async () => {
    let hostel: HostelDetail | null;
    if (user?.hostelId) {
      const res = await hostelGhar.hostels.get(user.hostelId);
      hostel = unwrap<HostelDetail>(res.data);
    } else {
      const list = await hostelGhar.hostels.list({ limit: 1 });
      const items = toPaginated<HostelDetail>(list.data).items;
      hostel = items[0] ?? null;
    }

    let dashboard: OwnerDashboard | null = null;
    try {
      const res = await hostelGhar.owner.dashboard();
      dashboard = unwrap<OwnerDashboard>(res.data);
    } catch {
      // The hostel profile can still render if the summary endpoint is unavailable.
    }

    return hostel ? { hostel, dashboard } : null;
  }, [user?.hostelId]);

  const hostel = data?.hostel;
  const dashboard = data?.dashboard;
  const rooms = hostel?.rooms ?? [];
  const totalRooms = dashboard?.totalRooms ?? hostel?.totalRooms ?? rooms.length;
  const totalBeds =
    dashboard?.totalBeds ??
    hostel?.totalBeds ??
    rooms.reduce((sum, room) => sum + (room.capacity ?? 0), 0);
  const occupiedBeds =
    dashboard?.occupiedBeds ??
    hostel?.occupiedBeds ??
    rooms.reduce((sum, room) => sum + (room.occupied ?? 0), 0);
  const ownerName = hostel?.owner
    ? `${hostel.owner.firstName} ${hostel.owner.lastName}`.trim()
    : hostel?.ownerName || "Hostel owner";
  const ownerInitials = ownerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DashboardShell
      title="Hostel Overview"
      subtitle="Hostel Ghar / Hostel — profile, contact and facilities."
    >
      <Protected permission="VIEW_HOSTEL">
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : error ? (
          <ErrorState title="Couldn't load hostel" description={error.message} onRetry={retry} />
        ) : !hostel ? (
          <EmptyState
            title="No hostel found"
            description="Your account is not linked to a hostel yet."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 sm:p-6 lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-lg font-bold text-neutral-500">
                    {hostel.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hostel.logoUrl}
                        alt={`${hostel.name} logo`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      hostel.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="truncate text-xl font-bold text-neutral-900">
                        {hostel.name}
                      </span>
                      <Badge tone="green">{hostel.status}</Badge>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                      <MapPin className="h-4 w-4" /> {hostel.address}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-3 text-[13px] text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" /> {hostel.phone}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {hostel.email}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:pl-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-sm font-bold text-white">
                    {hostel.owner?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hostel.owner.avatarUrl}
                        alt={`${ownerName} avatar`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      ownerInitials
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500">Owner</p>
                    <p className="truncate text-sm font-semibold text-neutral-900">{ownerName}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                {[
                  [String(totalRooms), "Rooms"],
                  [String(totalBeds), "Beds"],
                  [String(occupiedBeds), "Occupied"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-lg bg-surface-muted p-3">
                    <p className="text-xl font-bold">{v}</p>
                    <p className="text-xs text-neutral-500">{l}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Facilities" subtitle="What residents get" />
              <ul className="space-y-3 p-5">
                {FACILITIES.map((f) => (
                  <li key={f.label} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand">
                      <f.icon className="h-4 w-4 text-brand-ink" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{f.label}</span>
                      <span className="block text-xs text-neutral-500">{f.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </Protected>
    </DashboardShell>
  );
}
