"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  Building2,
  Users,
  Wallet,
  Clock,
  DoorOpen,
  Layers3,
  CalendarClock,
  Sparkles,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RevenueChart, OccupancyDonut } from "@/components/dashboard/Charts";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { RoleSwitcher } from "@/components/common/RoleSwitcher";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { setHostelId } from "@/lib/axios";
import { hostelGhar, normalizeOwnerDashboard, normalizeRoom, toPaginated } from "@/lib/hostelGhar";
import type { Fee, OwnerDashboard, OwnerDashboardHostel } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/EmptyState";

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { data: roomsData } = useApi(async () => {
    const res = await hostelGhar.rooms.list({
      limit: 100,
      ...(user?.hostelId ? { hostelId: user.hostelId } : {}),
    });
    return toPaginated<unknown>(res.data).items.map(normalizeRoom);
  }, [user?.hostelId]);
  const rooms = useMemo(() => roomsData ?? [], [roomsData]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await hostelGhar.owner.dashboard();
        // NOTE: pass the FULL axios body — normalizeOwnerDashboard merges `data`
        // with its siblings (`summary`, `floorOverview`, `revenueTrend`, …).
        // (Do NOT pre-unwrap: that would keep only the `data` hostel array
        // and drop every metric the dashboard renders.)
        const payload = res.data as unknown;
        const body =
          payload && typeof payload === "object" && !Array.isArray(payload)
            ? (payload as Record<string, unknown>)
            : {};
        const dataPart = body.data as OwnerDashboardHostel[] | undefined;
        const summary = Array.isArray(dataPart) ? dataPart[0] : undefined;
        if (summary?.hostelId) {
          setHostelId(summary.hostelId);
        }
        const normalizedDashboard: OwnerDashboard = normalizeOwnerDashboard(body);
        if (!cancelled) setDashboard(normalizedDashboard);
      } catch {
        // Backend down / no hostel yet → fall back to empty dashboard state.
        if (!cancelled) {
          setDashboard(null);
          setLoadError("Live dashboard unavailable — showing hostel setup state.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalResidents = dashboard?.totalResidents ?? 0;
  const residentsOnLeave = dashboard?.residentsOnLeaveToday ?? 0;
  const activeResidents = Math.max(0, totalResidents - residentsOnLeave);
  const occupiedBeds = dashboard?.occupiedBeds ?? 0;
  const totalBeds = dashboard?.totalBeds ?? 0;
  const availableBeds = dashboard?.availableBeds ?? Math.max(0, totalBeds - occupiedBeds);
  const monthlyRevenue = dashboard?.monthlyRevenue ?? 0;
  const pendingAmount = dashboard?.pendingAmount ?? dashboard?.pendingPayments ?? 0;
  const pendingCount = dashboard?.pendingCount ?? 0;
  const totalRooms = dashboard?.totalRooms ?? rooms.length;
  const availableRooms = dashboard?.availableRooms ?? 0;
  const occupiedRooms = dashboard?.occupiedRooms ?? Math.max(0, totalRooms - availableRooms);
  const occupancyPct =
    dashboard?.occupancyRate ?? (totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0);
  const totalHostels = dashboard?.totalHostels ?? 1;
  const hostels = useMemo<OwnerDashboardHostel[]>(
    () => (Array.isArray(dashboard?.hostels) ? dashboard.hostels : []),
    [dashboard]
  );
  // Subtitle prefers the backend's hostel row, then the linked hostel name.
  const hostelName = hostels[0]?.hostelName ?? user?.hostelName ?? "your hostel";

  const floorBreakdown = useMemo(() => {
    // Prefer the aggregate's floorOverview; fall back to the rooms list.
    const live = (dashboard?.floorOverview ?? []).map((item) => ({
      key: String(item.floor),
      label: item.label,
      count: item.rooms,
    }));
    if (live.length > 0) return live;
    const counts = new Map<number, number>();
    rooms.forEach((room) => {
      if (room.floor > 0) {
        counts.set(room.floor, (counts.get(room.floor) ?? 0) + 1);
      }
    });
    return [...counts.entries()]
      .map(([floor, count]) => ({ key: String(floor), label: `Floor ${floor}`, count }))
      .sort((a, b) => Number(a.key) - Number(b.key));
  }, [dashboard?.floorOverview, rooms]);

  const typeBreakdown = useMemo(() => {
    // Prefer the aggregate's roomMix; fall back to the rooms list.
    const live = (dashboard?.roomMix ?? []).map((item) => ({
      type: item.label,
      count: item.rooms,
    }));
    if (live.length > 0) return live;
    const counts = new Map<string, number>();
    rooms.forEach((room) => {
      const key = room.type ? room.type : "UNKNOWN";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  }, [dashboard?.roomMix, rooms]);

  const revenueTrend = useMemo(() => dashboard?.revenueTrend ?? [], [dashboard]);
  const recentPayments = useMemo<Fee[]>(
    () => (dashboard?.recentPayments ?? []).slice(0, 5),
    [dashboard]
  );

  const maxFloorCount = Math.max(1, ...floorBreakdown.map((item) => item.count));
  const maxTypeCount = Math.max(1, ...typeBreakdown.map((item) => item.count));

  return (
    <DashboardShell
      title="Dashboard"
      subtitle={`Welcome back — here's what's happening at ${hostelName}.`}
    >
      <Protected permission="VIEW_DASHBOARD">
        <div className="space-y-5">
          <RoleSwitcher />
          {hostels.length > 1 && (
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-ink" aria-hidden />
                <p className="text-sm font-bold text-neutral-900">
                  Your hostels ({hostels.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {hostels.map((h) => (
                  <Badge key={h.hostelId} tone="gray" className="px-2.5 py-1 text-xs">
                    {h.hostelName ?? "Hostel"}
                    {h.hostelType ? ` · ${h.hostelType}` : ""}
                    {h.totalActiveResidents !== undefined
                      ? ` · ${h.totalActiveResidents} residents`
                      : ""}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
          {loading ? (
            <div
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              aria-label="Loading dashboard"
            >
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : loadError && !dashboard ? (
            <ErrorState
              title="Dashboard unavailable"
              description={loadError}
              onRetry={() => window.location.reload()}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  icon={Users}
                  title="Total Residents"
                  value={String(totalResidents)}
                  delta={residentsOnLeave > 0 ? `${activeResidents} in-house` : "live"}
                  deltaUp
                  hint={
                    residentsOnLeave > 0
                      ? `${residentsOnLeave} on leave today`
                      : "from owner dashboard"
                  }
                />
                <StatCard
                  icon={BedDouble}
                  title="Occupied Beds"
                  value={totalBeds > 0 ? `${occupiedBeds} / ${totalBeds}` : String(occupiedBeds)}
                  delta={`${occupancyPct}%`}
                  deltaUp={occupancyPct >= 50}
                  hint="occupancy"
                />
                <StatCard
                  icon={DoorOpen}
                  title="Available Beds"
                  value={String(availableBeds)}
                  delta="live"
                  hint="ready to assign"
                />
                <StatCard
                  icon={Wallet}
                  title="Monthly Revenue"
                  value={formatCurrency(monthlyRevenue)}
                  delta="live"
                  deltaUp
                  hint="collected this month"
                />
                <StatCard
                  icon={Clock}
                  title="Pending Payments"
                  value={formatCurrency(pendingAmount)}
                  delta={pendingCount > 0 ? `${pendingCount} bills` : "live"}
                  hint="follow-up needed"
                />
                <StatCard
                  icon={Building2}
                  title="Available Rooms"
                  value={
                    totalRooms > 0 ? `${availableRooms} / ${totalRooms}` : String(availableRooms)
                  }
                  delta={occupiedRooms > 0 ? `${occupiedRooms} occupied` : "live"}
                  hint="ready to assign"
                />
                <StatCard
                  icon={CalendarClock}
                  title="Residents on Leave"
                  value={String(residentsOnLeave)}
                  delta={totalHostels > 1 ? `${totalHostels} hostels` : "today"}
                  hint="back soon"
                />
              </div>
              <QuickActions />
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-neutral-500">Floor overview</p>
                      <h3 className="mt-1 text-lg font-semibold text-neutral-900">
                        Rooms by floor
                      </h3>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted">
                      <Layers3 className="h-[18px] w-[18px] text-neutral-800" />
                    </span>
                  </div>
                  <div className="space-y-3">
                    {floorBreakdown.length > 0 ? (
                      floorBreakdown.map(({ key, label, count }) => (
                        <div key={key}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-neutral-700">{label}</span>
                            <span className="text-neutral-500">{count} rooms</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-brand-ink"
                              style={{ width: `${(count / maxFloorCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-neutral-500">No room floor data available yet.</p>
                    )}
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-neutral-500">Room mix</p>
                      <h3 className="mt-1 text-lg font-semibold text-neutral-900">Types</h3>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted">
                      <Building2 className="h-[18px] w-[18px] text-neutral-800" />
                    </span>
                  </div>
                  <div className="space-y-3">
                    {typeBreakdown.length > 0 ? (
                      typeBreakdown.map(({ type, count }) => (
                        <div key={type}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-neutral-700">{type}</span>
                            <span className="text-neutral-500">{count} rooms</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: `${(count / maxTypeCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-neutral-500">No room type data available yet.</p>
                    )}
                  </div>
                </Card>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <RevenueChart points={revenueTrend} collectionRate={dashboard?.collectionRate} />
                </div>
                <OccupancyDonut occupied={occupiedBeds} total={Math.max(totalBeds, 1)} />
              </div>
              <RecentPayments payments={recentPayments} hostelId={user?.hostelId} />
            </>
          )}
        </div>
      </Protected>
    </DashboardShell>
  );
}
