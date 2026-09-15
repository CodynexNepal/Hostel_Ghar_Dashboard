"use client";
import { useEffect, useState } from "react";
import { BedDouble, Building2, Users, Wallet, Clock, DoorOpen } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RevenueChart, OccupancyDonut } from "@/components/dashboard/Charts";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { RoleSwitcher } from "@/components/common/RoleSwitcher";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { setHostelId } from "@/lib/axios";
import { hostelGhar, unwrap } from "@/lib/hostelGhar";
import type { OwnerDashboard, OwnerDashboardHostel } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/EmptyState";

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
  const totalRooms = dashboard?.totalRooms ?? 0;
  const availableRooms = dashboard?.availableRooms ?? 0;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const hostelName = user?.hostelName ?? "your hostel";

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
