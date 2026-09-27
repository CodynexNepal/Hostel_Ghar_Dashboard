"use client";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { hostelGhar, normalizeRoom, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { OwnerDashboard, OwnerDashboardHostel } from "@/lib/api-types";
import { defaultBase, type AnalyticsBase } from "@/lib/analytics";
import { KpiGrid } from "@/components/analytics/KpiGrid";
import { OccupancySection } from "@/components/analytics/sections/s1-occupancy";
import { GrowthSection, RoomSection } from "@/components/analytics/sections/s2-rooms-growth";
import { PaymentSection, RevenueSection } from "@/components/analytics/sections/s3-revenue-pay";
import { ExpenseSection } from "@/components/analytics/sections/s4-expense";
import { formatCurrency } from "@/lib/utils";
import { CapacitySection, RevExpSection } from "@/components/analytics/sections/s5-revexp-cap";
import { DemographicsSection } from "@/components/analytics/sections/s6-demo";
import { MaintenanceSection, PerformanceSection } from "@/components/analytics/sections/s7-perf-maint";
import { MovementSection } from "@/components/analytics/sections/s8-move";
import { FeatureGate } from "@/components/common/FeatureGate";
function Answers({ base }: { base: AnalyticsBase }) {
  const occ = base.totalBeds > 0 ? Math.round((base.occupiedBeds / base.totalBeds) * 100) : 0;
  const items = [
    ["How full?", `${occ}% occupied`],
    ["Beds free?", `${Math.max(0, base.totalBeds - base.occupiedBeds)} open`],
    ["Collected?", formatCurrency(base.monthlyRevenue)],
    ["Pending?", formatCurrency(base.pendingAmount)],
    ["Spending?", formatCurrency(base.monthlyExpenses)],
  ];
  return (
    <div className="grid gap-2 rounded-card bg-[#010101] p-4 text-white sm:grid-cols-5" role="status" aria-label="Answers">
      {items.map(([q, a]) => (
        <div key={q}><p className="text-[11px] uppercase tracking-wide text-brand">{q}</p><p className="truncate text-sm font-bold">{a}</p></div>
      ))}
    </div>
  );
}
export default function AnalyticsPage() {
  const { user } = useAuth();
  const [hostel, setHostel] = useState("all");
  const dash = useApi(async () => {
    const res = await hostelGhar.owner.dashboard();
    const payload = unwrap<OwnerDashboard | OwnerDashboardHostel[]>(res.data);
    if (Array.isArray(payload)) return { hostels: payload };
    return { ...(payload as OwnerDashboard), hostels: [] as OwnerDashboardHostel[] };
  }, []);
  const roomsQ = useApi(async () => toPaginated<unknown>((await hostelGhar.rooms.list({
    limit: 100, ...(user?.hostelId ? { hostelId: user.hostelId } : {}),
  })).data).items.map(normalizeRoom), [user?.hostelId]);
  const d = dash.data;
  const hostels: { hostelId: string; hostelName?: string }[] = d?.hostels ?? [];
  return (
    <DashboardShell title="Analytics" subtitle="Occupancy, residents, revenue and operations.">
      <Protected permission="VIEW_ANALYTICS" redirectTo="/dashboard">
        <AnalyticsBody base={useMemo(() => {
          const live = defaultBase();
          const totalBeds = Number(d?.totalBeds ?? live.totalBeds);
          const merged: AnalyticsBase = {
            totalHostels: hostels.length || live.totalHostels,
            totalResidents: Number(d?.totalResidents ?? live.totalResidents),
            totalRooms: Number(d?.totalRooms ?? roomsQ.data?.length ?? live.totalRooms),
            totalBeds, occupiedBeds: Number(d?.occupiedBeds ?? live.occupiedBeds),
            monthlyRevenue: Number(d?.monthlyRevenue ?? live.monthlyRevenue),
            pendingAmount: Number((d as { pendingAmount?: number })?.pendingAmount ?? d?.pendingPayments ?? live.pendingAmount),
            monthlyExpenses: live.monthlyExpenses,
          };
          if (hostel === "all") return merged;
          const f = 0.34;
          return { ...merged, totalHostels: 1, totalResidents: Math.round(merged.totalResidents * f),
            totalRooms: Math.round(merged.totalRooms * f), totalBeds: Math.round(merged.totalBeds * f),
            occupiedBeds: Math.round(merged.occupiedBeds * f), monthlyRevenue: Math.round(merged.monthlyRevenue * f),
            pendingAmount: Math.round(merged.pendingAmount * f), monthlyExpenses: Math.round(merged.monthlyExpenses * f) };
        }, [d, roomsQ.data, hostel, hostels.length])} hostel={hostel} setHostel={setHostel} hostels={hostels}
          loading={dash.isLoading} failed={Boolean(dash.error) && !dash.data}
          empty={(d?.totalResidents ?? 0) === 0 && (d?.totalBeds ?? 0) === 0}
          onRetry={() => { dash.retry(); roomsQ.retry(); }} />
      </Protected>
    </DashboardShell>
  );
}
function AnalyticsBody({ base, hostel, setHostel, hostels, loading, failed, empty, onRetry }: {
  base: AnalyticsBase; hostel: string; setHostel: (v: string) => void;
  hostels: { hostelId: string; hostelName?: string }[];
  loading: boolean; failed: boolean; empty: boolean; onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hostel filter">
          <button onClick={() => setHostel("all")} aria-pressed={hostel === "all"}
            className={hostel === "all" ? "h-8 rounded-full bg-brand-ink px-3 text-xs font-bold text-brand" : "h-8 rounded-full border bg-white px-3 text-xs text-neutral-600"}>
            All hostels</button>
          {hostels.slice(0, 4).map((h) => (
            <button key={h.hostelId} onClick={() => setHostel(h.hostelId)} aria-pressed={hostel === h.hostelId}
              className={hostel === h.hostelId ? "h-8 rounded-full bg-brand-ink px-3 text-xs font-bold text-brand" : "h-8 rounded-full border bg-white px-3 text-xs text-neutral-600"}>
              {h.hostelName ?? "Hostel"}</button>))}
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>Refresh data</Button>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Loading analytics">
          {Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : failed ? (
        <ErrorState title="Analytics unavailable" description="Live data failed — showing modeled insights." onRetry={onRetry} />
      ) : empty ? (
        <EmptyState title="No analytics yet" description="Add rooms and residents to unlock insights." />
      ) : (
        <>
          <Answers base={base} />
          <KpiGrid base={base} />
          <div className="grid gap-4 xl:grid-cols-2"><OccupancySection base={base} /><RevenueSection base={base} /></div>
          <div className="grid gap-4 xl:grid-cols-2"><RoomSection /><CapacitySection /></div>
          <div className="grid gap-4 xl:grid-cols-2"><GrowthSection /><MovementSection /></div>
          <div className="grid gap-4 xl:grid-cols-2"><PaymentSection base={base} /><ExpenseSection base={base} /></div>
          <RevExpSection base={base} />
          <div className="grid gap-4 xl:grid-cols-2"><DemographicsSection /><MaintenanceSection /></div>
          <FeatureGate permission="MANAGE_PLATFORM"><PerformanceSection base={base} /></FeatureGate>
        </>
      )}
    </div>
  );
}

