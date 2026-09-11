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

export default function OwnerDashboardPage() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Welcome back — here's what's happening at Sunrise Boys Hostel."
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
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  icon={Users}
                  title="Total Residents"
                  value="248"
                  delta="+12.5%"
                  deltaUp
                  hint="vs last month"
                />
                <StatCard
                  icon={BedDouble}
                  title="Occupied Beds"
                  value="58 / 72"
                  delta="+4.2%"
                  deltaUp
                  hint="80% occupancy"
                />
                <StatCard
                  icon={DoorOpen}
                  title="Available Beds"
                  value="14"
                  delta="-2 beds"
                  hint="vs last week"
                />
                <StatCard
                  icon={Wallet}
                  title="Monthly Revenue"
                  value={formatCurrency(684500)}
                  delta="+8.1%"
                  deltaUp
                  hint="collected in Sep"
                />
                <StatCard
                  icon={Clock}
                  title="Pending Payments"
                  value={formatCurrency(86500)}
                  delta="7 dues"
                  hint="follow-up needed"
                />
                <StatCard
                  icon={Building2}
                  title="Available Rooms"
                  value="6 / 24"
                  delta="3 floors"
                  hint="ready to assign"
                />
              </div>
              <QuickActions />
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <RevenueChart />
                </div>
                <OccupancyDonut occupied={58} total={72} />
              </div>
              <RecentPayments />
            </>
          )}
        </div>
      </Protected>
    </DashboardShell>
  );
}
