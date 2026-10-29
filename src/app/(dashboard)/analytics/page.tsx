"use client";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import {
  hostelGhar,
  normalizeExpenseList,
  normalizeOwnerDashboard,
  normalizeOwnerSummary,
  normalizeResident,
  normalizeRoom,
  toPaginated,
  unwrap,
} from "@/lib/hostelGhar";
import type { Expense, Fee, OwnerDashboard, OwnerDashboardHostel } from "@/lib/api-types";
import type { Resident } from "@/types/resident";
import type { Room } from "@/types/hostel";
import { emptyBase, type AnalyticsBase } from "@/lib/analytics";
import {
  collectionPct,
  deriveFeeCounts,
  deriveRevenueTrend,
  expenseTotal,
  groupExpensesByMonth,
  monthlyCollected,
  roomsTotals,
  totalPending,
} from "@/lib/analytics-live";
import { KpiGrid } from "@/components/analytics/KpiGrid";
import { OccupancySection } from "@/components/analytics/sections/s1-occupancy";
import { GrowthSection, RoomSection } from "@/components/analytics/sections/s2-rooms-growth";
import { PaymentSection, RevenueSection } from "@/components/analytics/sections/s3-revenue-pay";
import { ExpenseSection } from "@/components/analytics/sections/s4-expense";
import { formatCurrency } from "@/lib/utils";
import { CapacitySection, RevExpSection } from "@/components/analytics/sections/s5-revexp-cap";
import { DemographicsSection } from "@/components/analytics/sections/s6-demo";
import { PerformanceSection } from "@/components/analytics/sections/s7-perf-maint";
import { MovementSection } from "@/components/analytics/sections/s8-move";
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
    <div
      className="grid gap-2 rounded-card bg-[#010101] p-4 text-white sm:grid-cols-5"
      role="status"
      aria-label="Answers"
    >
      {items.map(([q, a]) => (
        <div key={q}>
          <p className="text-[11px] uppercase tracking-wide text-brand">{q}</p>
          <p className="truncate text-sm font-bold">{a}</p>
        </div>
      ))}
    </div>
  );
}
export default function AnalyticsPage() {
  const { user } = useAuth();
  const [hostel, setHostel] = useState("all");
  /**
   * Primary source: GET /analytics/owner/summary (owner-scoped totals + fee
   * aggregates + revenueTrend). Normalized by `normalizeOwnerSummary` which
   * tolerates envelope/camel/snake shapes. Errors are left to `useApi` state
   * so a 403/404 (e.g. admin token) simply yields `data: null` and the
   * dashboard aggregate below takes over — never a hard failure.
   */
  const summaryQ = useApi(async () => {
    const res = await hostelGhar.analytics.ownerSummary();
    return normalizeOwnerSummary(res.data);
  }, []);
  /** Fallback / enrichment: GET /owner/dashboard aggregate + hostel rows. */
  const dash = useApi(async () => {
    const res = await hostelGhar.owner.dashboard();
    const payload = unwrap<OwnerDashboard | OwnerDashboardHostel[]>(res.data);
    if (Array.isArray(payload)) {
      return { hostels: payload } as OwnerDashboard & {
        hostels: OwnerDashboardHostel[];
      };
    }
    const full = res.data as unknown;
    const normalized = normalizeOwnerDashboard(full);
    // Preserve the raw per-hostel rows for the hostel filter.
    const rawHostels = Array.isArray((payload as OwnerDashboard)?.hostels)
      ? (payload as OwnerDashboard).hostels
      : undefined;
    return { ...normalized, hostels: (rawHostels ?? []) as OwnerDashboardHostel[] };
  }, []);
  const roomsQ = useApi(
    async () =>
      toPaginated<unknown>(
        (
          await hostelGhar.rooms.list({
            limit: 100,
            ...(user?.hostelId ? { hostelId: user.hostelId } : {}),
          })
        ).data
      ).items.map(normalizeRoom),
    [user?.hostelId]
  );
  const residentsQ = useApi(async () => {
    try {
      const res = await hostelGhar.owner.residents(
        user?.hostelId ? { hostelId: user.hostelId } : undefined
      );
      return toPaginated<unknown>(unwrap<unknown>(res.data)).items.map(normalizeResident);
    } catch {
      return [] as Resident[];
    }
  }, [user?.hostelId]);
  const expensesQ = useApi(async () => {
    try {
      const res = await hostelGhar.expenses.list({
        limit: 100,
        ...(user?.hostelId ? { hostelId: user.hostelId } : {}),
      });
      return normalizeExpenseList(res.data);
    } catch {
      return [] as Expense[];
    }
  }, [user?.hostelId]);
  const feesQ = useApi(async () => {
    try {
      const hid =
        user?.hostelId ||
        (Array.isArray(dash.data?.hostels) ? dash.data.hostels[0]?.hostelId : undefined);
      if (!hid) return [] as Fee[];
      const res = await hostelGhar.fees.hostelFees(hid, { limit: 500 });
      return toPaginated<Fee>(res.data).items;
    } catch {
      return [] as Fee[];
    }
  }, [user?.hostelId, dash.data?.hostels]);
  const s = summaryQ.data;
  const d = dash.data;
  const dashHostels = d?.hostels;
  const roomsData = roomsQ.data;
  const residentsData = residentsQ.data;
  const expensesData = expensesQ.data;
  const feesData = feesQ.data;
  const hostels: OwnerDashboardHostel[] = useMemo(
    () => (Array.isArray(dashHostels) ? dashHostels : []),
    [dashHostels]
  );
  const liveRooms: Room[] = useMemo(() => roomsData ?? [], [roomsData]);
  const liveResidents: Resident[] = useMemo(() => residentsData ?? [], [residentsData]);
  const liveExpenses: Expense[] = useMemo(() => expensesData ?? [], [expensesData]);
  const liveFees: Fee[] = useMemo(() => feesData ?? [], [feesData]);
  const isLoading =
    summaryQ.isLoading ||
    dash.isLoading ||
    roomsQ.isLoading ||
    residentsQ.isLoading ||
    expensesQ.isLoading ||
    feesQ.isLoading;
  // Owner endpoints only: failed when NEITHER aggregate responds.
  // List endpoints degrade to [] (their sections show live empty-states).
  const failed = Boolean(summaryQ.error && dash.error && !s && !d);
  const rowResidents = hostels.reduce((sum, h) => sum + (Number(h.totalActiveResidents) || 0), 0);
  const derivedRooms = liveRooms.length || Number(s?.totalRooms ?? d?.totalRooms ?? 0) || 0;
  const isEmpty =
    hostels.length === 0 &&
    liveRooms.length === 0 &&
    liveResidents.length === 0 &&
    liveExpenses.length === 0 &&
    liveFees.length === 0 &&
    rowResidents === 0;
  return (
    <DashboardShell
      title="Analytics"
      subtitle="Your hostels — occupancy, residents, revenue and operations."
    >
      <Protected permission="VIEW_ANALYTICS" redirectTo="/dashboard">
        <AnalyticsBody
          base={useMemo(() => {
            // Owner-scoped live-only: rooms list → beds, residents list →
            // residents, expenses list → monthly spend. Summary/dashboard fill
            // gaps; NOTHING falls back to platform demo totals.
            const rt = liveRooms.length > 0 ? roomsTotals(liveRooms) : null;
            const rawTrend =
              s?.revenueTrend && s.revenueTrend.length > 0
                ? s.revenueTrend
                : d?.revenueTrend && d.revenueTrend.length > 0
                  ? d.revenueTrend
                  : [];
            const summaryTrend = rawTrend.map((p) => ({
              label: p.label,
              collected: p.collected,
              billed:
                p.billed ?? (p.outstanding !== undefined ? p.collected + p.outstanding : undefined),
            }));
            const liveTrend = summaryTrend.length > 0 ? summaryTrend : undefined;
            const trendCollected = (liveTrend ?? []).reduce((a, p) => a + p.collected, 0);
            const trendBilled = (liveTrend ?? []).reduce(
              (a, p) => a + (p.billed ?? p.collected),
              0
            );
            const expMonths = groupExpensesByMonth(liveExpenses);
            const monthlyExp =
              expMonths.length > 0
                ? expMonths[expMonths.length - 1].total
                : expenseTotal(liveExpenses);
            const totalResidents =
              liveResidents.length > 0
                ? liveResidents.length
                : Number(s?.totalResidents ?? s?.residents ?? d?.totalResidents ?? rowResidents) ||
                  0;
            const merged: AnalyticsBase = {
              ...emptyBase(),
              totalHostels: hostels.length,
              totalResidents,
              totalRooms: rt
                ? rt.totalRooms
                : Number(s?.totalRooms ?? d?.totalRooms ?? derivedRooms) || 0,
              totalBeds: rt ? rt.totalBeds : Number(s?.totalBeds ?? d?.totalBeds) || 0,
              occupiedBeds: rt ? rt.occupiedBeds : Number(s?.occupiedBeds ?? d?.occupiedBeds) || 0,
              monthlyRevenue:
                trendCollected ||
                Number(s?.monthlyRevenue ?? s?.revenue ?? s?.totalRevenue ?? d?.monthlyRevenue) ||
                0,
              pendingAmount:
                (trendBilled > 0 ? Math.max(0, trendBilled - trendCollected) : 0) ||
                Number(
                  s?.pendingAmount ?? s?.pendingDues ?? d?.pendingAmount ?? d?.pendingPayments
                ) ||
                0,
              monthlyExpenses: monthlyExp || 0,
              isLive: Boolean(
                s ||
                d ||
                liveRooms.length > 0 ||
                liveResidents.length > 0 ||
                liveExpenses.length > 0 ||
                liveFees.length > 0
              ),
              liveTrend,
              hasRevenueTrend: (liveTrend?.length ?? 0) > 0,
              feeCounts: s?.feeCounts,
              occupancyRate:
                s?.occupancyRate ??
                s?.occupancy ??
                d?.occupancyRate ??
                (rt && rt.totalBeds > 0
                  ? Math.round((rt.occupiedBeds / rt.totalBeds) * 1000) / 10
                  : undefined),
              collectionRate:
                s?.collectionRate ??
                d?.collectionRate ??
                collectionPct(trendCollected, trendBilled),
              pendingCount: s?.pendingCount ?? d?.pendingCount,
              availableRooms:
                s?.availableRooms ??
                d?.availableRooms ??
                (rt ? liveRooms.filter((r) => r.status === "AVAILABLE").length : undefined),
              rooms: liveRooms,
              residents: liveResidents,
              fees: liveFees,
              expenses: liveExpenses,
              hasRooms: !roomsQ.isLoading,
              hasResidents: !residentsQ.isLoading,
              hasFees: !feesQ.isLoading && liveFees.length > 0,
              hasExpenses: !expensesQ.isLoading,
              hostels: hostels.map((h) => ({
                hostelId: h.hostelId,
                hostelName: h.hostelName,
                hostelType: h.hostelType,
                totalActiveResidents: h.totalActiveResidents,
                residentsOnLeaveToday: h.residentsOnLeaveToday,
              })),
            };
            void deriveFeeCounts;
            void deriveRevenueTrend;
            void monthlyCollected;
            void totalPending;
            void expenseTotal;
            return merged;
          }, [
            s,
            d,
            liveRooms,
            liveResidents,
            liveExpenses,
            liveFees,
            hostels,
            roomsQ.isLoading,
            residentsQ.isLoading,
            feesQ.isLoading,
            expensesQ.isLoading,
            derivedRooms,
            rowResidents,
          ])}
          hostel={hostel}
          setHostel={setHostel}
          hostels={hostels}
          loading={isLoading}
          failed={failed}
          empty={isEmpty}
          onRetry={() => {
            summaryQ.retry();
            dash.retry();
            roomsQ.retry();
            residentsQ.retry();
            expensesQ.retry();
          }}
        />
      </Protected>
    </DashboardShell>
  );
}
function AnalyticsBody({
  base,
  hostel,
  setHostel,
  hostels,
  loading,
  failed,
  empty,
  onRetry,
}: {
  base: AnalyticsBase;
  hostel: string;
  setHostel: (v: string) => void;
  hostels: { hostelId: string; hostelName?: string }[];
  loading: boolean;
  failed: boolean;
  empty: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hostel filter">
          <button
            onClick={() => setHostel("all")}
            aria-pressed={hostel === "all"}
            className={
              hostel === "all"
                ? "h-8 rounded-full bg-brand-ink px-3 text-xs font-bold text-brand"
                : "h-8 rounded-full border bg-white px-3 text-xs text-neutral-600"
            }
          >
            All hostels
          </button>
          {hostels.slice(0, 4).map((h) => (
            <button
              key={h.hostelId}
              onClick={() => setHostel(h.hostelId)}
              aria-pressed={hostel === h.hostelId}
              className={
                hostel === h.hostelId
                  ? "h-8 rounded-full bg-brand-ink px-3 text-xs font-bold text-brand"
                  : "h-8 rounded-full border bg-white px-3 text-xs text-neutral-600"
              }
            >
              {h.hostelName ?? "Hostel"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Refresh data
        </Button>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Loading analytics">
          {Array.from({ length: 10 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : failed ? (
        <ErrorState
          title="Analytics unavailable"
          description="Live owner data failed to load."
          onRetry={onRetry}
        />
      ) : empty ? (
        <EmptyState
          title="No analytics yet"
          description="Add rooms and residents to unlock insights for your hostels."
        />
      ) : (
        <>
          <Answers base={base} />
          <KpiGrid base={base} />
          <div className="grid gap-4 xl:grid-cols-2">
            <OccupancySection base={base} />
            <RevenueSection base={base} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <RoomSection base={base} />
            <CapacitySection base={base} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <GrowthSection base={base} />
            <MovementSection base={base} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <PaymentSection base={base} />
            <ExpenseSection base={base} />
          </div>
          <RevExpSection base={base} />
          <div className="grid gap-4 xl:grid-cols-2">
            <DemographicsSection base={base} />
            <PerformanceSection base={base} />
          </div>
        </>
      )}
    </div>
  );
}
