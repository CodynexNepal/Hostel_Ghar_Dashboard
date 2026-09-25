"use client";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, Building2, Users, Wallet, Clock, DoorOpen, Layers3 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RevenueChart, OccupancyDonut } from "@/components/dashboard/Charts";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { RoleSwitcher } from "@/components/common/RoleSwitcher";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { setHostelId } from "@/lib/axios";
import { hostelGhar, normalizeRoom, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { OwnerDashboard, OwnerDashboardHostel } from "@/lib/api-types";
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
        const payload = unwrap<OwnerDashboard | OwnerDashboardHostel[]>(res.data);
        const summary = Array.isArray(payload) ? payload[0] : undefined;
        const dashboardData = Array.isArray(payload) ? undefined : payload;
        if (summary?.hostelId) {
          setHostelId(summary.hostelId);
        }
        const normalizedDashboard: OwnerDashboard = summary
          ? {
              totalResidents: Number(summary?.totalActiveResidents ?? 0),
            }
          : (dashboardData ?? {});
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
  const occupiedBeds = dashboard?.occupiedBeds ?? 0;
  const totalBeds = dashboard?.totalBeds ?? 0;
  const availableBeds = dashboard?.availableBeds ?? Math.max(0, totalBeds - occupiedBeds);
  const monthlyRevenue = dashboard?.monthlyRevenue ?? 0;
  const pendingAmount = dashboard?.pendingAmount ?? dashboard?.pendingPayments ?? 0;
  const totalRooms = dashboard?.totalRooms ?? rooms.length;
  const availableRooms = dashboard?.availableRooms ?? rooms.filter((room) => room.status === "AVAILABLE").length;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const hostelName = user?.hostelName ?? "your hostel";

  const floorBreakdown = useMemo(() => {
    const counts = new Map<number, number>();
    rooms.forEach((room) => {
      if (room.floor > 0) {
        counts.set(room.floor, (counts.get(room.floor) ?? 0) + 1);
      }
    });
    return [...counts.entries()]
      .map(([floor, count]) => ({ floor, count }))
      .sort((a, b) => a.floor - b.floor);
  }, [rooms]);

  const typeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    rooms.forEach((room) => {
      const key = room.type ? room.type : "UNKNOWN";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  }, [rooms]);

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
                  delta="live"
                  deltaUp
                  hint="from owner dashboard"
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
                  delta="live"
                  hint="follow-up needed"
                />
                <StatCard
                  icon={Building2}
                  title="Available Rooms"
                  value={
                    totalRooms > 0 ? `${availableRooms} / ${totalRooms}` : String(availableRooms)
                  }
                  delta="live"
                  hint="ready to assign"
                />
              </div>
              <QuickActions />
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-neutral-500">Floor overview</p>
                      <h3 className="mt-1 text-lg font-semibold text-neutral-900">Rooms by floor</h3>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted">
                      <Layers3 className="h-[18px] w-[18px] text-neutral-800" />
                    </span>
                  </div>
                  <div className="space-y-3">
                    {floorBreakdown.length > 0 ? (
                      floorBreakdown.map(({ floor, count }) => (
                        <div key={floor}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-neutral-700">Floor {floor}</span>
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
                  <RevenueChart />
                </div>
                <OccupancyDonut occupied={occupiedBeds} total={Math.max(totalBeds, 1)} />
              </div>
              <RecentPayments hostelId={user?.hostelId} />
            </>
          )}
        </div>
      </Protected>
    </DashboardShell>
  );
}
