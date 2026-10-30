"use client";
import { useMemo, useState } from "react";
import {
  Activity,
  BedDouble,
  Download,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
import { downloadCSV, emptyBase, toCSV, type AnalyticsBase } from "@/lib/analytics";
import {
  collectionPct,
  deriveFeeCounts,
  deriveRevenueTrend,
  expenseTotal,
  groupExpensesByMonth,
  monthlyCollected,
  roomsTotals,
  totalPending,
  unpaidCount,
} from "@/lib/analytics-live";
import { getHostelId } from "@/lib/axios";
import { KpiGrid } from "@/components/analytics/KpiGrid";
import { OccupancySection } from "@/components/analytics/sections/s1-occupancy";
import { GrowthSection, RoomSection } from "@/components/analytics/sections/s2-rooms-growth";
import { PaymentSection, RevenueSection } from "@/components/analytics/sections/s3-revenue-pay";
import { ExpenseSection } from "@/components/analytics/sections/s4-expense";
import { formatCurrency, cn } from "@/lib/utils";
import { CapacitySection, RevExpSection } from "@/components/analytics/sections/s5-revexp-cap";
import { DemographicsSection } from "@/components/analytics/sections/s6-demo";
import { PerformanceSection } from "@/components/analytics/sections/s7-perf-maint";
import { MovementSection } from "@/components/analytics/sections/s8-move";

function ExecutiveSpotlight({ base }: { base: AnalyticsBase }) {
  const occ = base.totalBeds > 0 ? Math.round((base.occupiedBeds / base.totalBeds) * 100) : 0;
  const net = base.monthlyRevenue - base.monthlyExpenses;
  const isProfit = net >= 0;
  const freeBeds = Math.max(0, base.totalBeds - base.occupiedBeds);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-800/90 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-5 text-white shadow-xl sm:p-6">
      {/* Background ambient accents */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-brand shadow-inner ring-1 ring-white/15">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
                Hostel Performance Spotlight
              </h2>
              <p className="text-xs text-neutral-400">
                Live executive health indicators and real-time business telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/80 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Live Telemetry
            </span>
          </div>
        </div>

        {/* 5 Core Metric Highlights */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-6">
          {/* 1. Occupancy */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Occupancy
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-white">{occ}%</span>
              <span className="text-xs font-medium text-neutral-400">filled</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  occ >= 80 ? "bg-emerald-500" : occ >= 50 ? "bg-brand" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, occ)}%` }}
              />
            </div>
          </div>

          {/* 2. Free Beds */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Available Capacity
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-white">{freeBeds}</span>
              <span className="text-xs font-medium text-neutral-400">open beds</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {base.occupiedBeds} of {base.totalBeds} beds occupied
            </p>
          </div>

          {/* 3. Monthly Revenue */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Collected Revenue
            </span>
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="text-2xl font-black tracking-tight text-emerald-400">
                {formatCurrency(base.monthlyRevenue)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">Current cycle collected</p>
          </div>

          {/* 4. Pending Amount */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Pending Dues
            </span>
            <div className="flex items-baseline gap-1.5 truncate">
              <span
                className={`text-2xl font-black tracking-tight ${
                  base.pendingAmount > 0 ? "text-amber-400" : "text-white"
                }`}
              >
                {formatCurrency(base.pendingAmount)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">Awaiting collection</p>
          </div>

          {/* 5. Net Margin */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Net Operating Margin
            </span>
            <div className="flex items-baseline gap-1.5 truncate">
              <span
                className={`text-2xl font-black tracking-tight ${
                  isProfit ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCurrency(net)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {isProfit ? "Operational surplus" : "Operating deficit"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();

  const summaryQ = useApi(async () => {
    const res = await hostelGhar.analytics.ownerSummary();
    return normalizeOwnerSummary(res.data);
  }, []);

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
      const hostelIds = new Set<string>();
      if (user?.hostelId) hostelIds.add(user.hostelId);
      if (Array.isArray(dash.data?.hostels)) {
        dash.data.hostels.forEach((h) => {
          if (h.hostelId) hostelIds.add(h.hostelId);
        });
      }
      const direct = getHostelId();
      if (direct) hostelIds.add(direct);

      if (hostelIds.size === 0) return [] as Fee[];

      const allFees: Fee[] = [];
      for (const hid of hostelIds) {
        try {
          const res = await hostelGhar.fees.hostelFees(hid, { limit: 500 });
          allFees.push(...toPaginated<Fee>(res.data).items);
        } catch {
          // ignore
        }
      }
      return allFees;
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
      title="Analytics & Business Intelligence"
      subtitle="Comprehensive insights across occupancy, financials, resident dynamics, and operations."
    >
      <Protected permission="VIEW_ANALYTICS" redirectTo="/dashboard">
        <AnalyticsBody
          base={useMemo(() => {
            const rt = liveRooms.length > 0 ? roomsTotals(liveRooms) : null;

            // 1. Derive revenue trend from live fees if backend summary has no trend
            const feeTrend = liveFees.length > 0 ? deriveRevenueTrend(liveFees) : [];
            const rawTrend =
              s?.revenueTrend && s.revenueTrend.length > 0
                ? s.revenueTrend
                : d?.revenueTrend && d.revenueTrend.length > 0
                  ? d.revenueTrend
                  : feeTrend;

            const summaryTrend = rawTrend.map((p) => {
              const item = p as {
                label: string;
                collected: number;
                billed?: number;
                outstanding?: number;
              };
              return {
                label: item.label,
                collected: item.collected,
                billed:
                  item.billed ??
                  (item.outstanding !== undefined ? item.collected + item.outstanding : undefined),
              };
            });
            const liveTrend = summaryTrend.length > 0 ? summaryTrend : undefined;

            const trendCollected = (liveTrend ?? []).reduce((a, p) => a + p.collected, 0);
            const trendBilled = (liveTrend ?? []).reduce(
              (a, p) => a + (p.billed ?? p.collected),
              0
            );

            // 2. Revenue calculations
            const apiRevenue =
              Number(s?.monthlyRevenue ?? s?.revenue ?? s?.totalRevenue ?? d?.monthlyRevenue) || 0;
            const currentMonthRevenue = monthlyCollected(liveFees);
            const lastActiveMonthRevenue =
              [...feeTrend].reverse().find((m) => m.collected > 0)?.collected ?? 0;
            const currentMonthBilled =
              feeTrend.length > 0 ? (feeTrend[feeTrend.length - 1].billed ?? 0) : 0;

            const derivedMonthlyRevenue =
              currentMonthRevenue > 0
                ? currentMonthRevenue
                : lastActiveMonthRevenue > 0
                  ? lastActiveMonthRevenue
                  : currentMonthBilled > 0
                    ? currentMonthBilled
                    : trendCollected;

            const resolvedMonthlyRevenue = apiRevenue > 0 ? apiRevenue : derivedMonthlyRevenue;

            // 3. Pending dues calculations
            const ledgerPending = liveFees.length > 0 ? totalPending(liveFees) : 0;
            const trendPending = trendBilled > 0 ? Math.max(0, trendBilled - trendCollected) : 0;
            const apiPending =
              Number(
                s?.pendingAmount ?? s?.pendingDues ?? d?.pendingAmount ?? d?.pendingPayments
              ) || 0;
            const resolvedPendingAmount =
              ledgerPending > 0 ? ledgerPending : trendPending || apiPending;

            // 4. Monthly Expenses calculations
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
              monthlyRevenue: resolvedMonthlyRevenue,
              pendingAmount: resolvedPendingAmount,
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
              feeCounts:
                s?.feeCounts ?? (liveFees.length > 0 ? deriveFeeCounts(liveFees) : undefined),
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
              pendingCount:
                s?.pendingCount ??
                d?.pendingCount ??
                (liveFees.length > 0 ? unpaidCount(liveFees) : undefined),
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
          loading={isLoading}
          failed={failed}
          empty={isEmpty}
          onRetry={() => {
            summaryQ.retry();
            dash.retry();
            roomsQ.retry();
            residentsQ.retry();
            expensesQ.retry();
            feesQ.retry();
          }}
        />
      </Protected>
    </DashboardShell>
  );
}

type AnalyticsTab = "all" | "financials" | "occupancy" | "operations";

const TABS: { id: AnalyticsTab; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "Full Dashboard", icon: LayoutGrid },
  { id: "financials", label: "Financials & Revenue", icon: Wallet },
  { id: "occupancy", label: "Occupancy & Inventory", icon: BedDouble },
  { id: "operations", label: "Operations & Growth", icon: Activity },
];

function AnalyticsBody({
  base,
  loading,
  failed,
  empty,
  onRetry,
}: {
  base: AnalyticsBase;
  loading: boolean;
  failed: boolean;
  empty: boolean;
  onRetry: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("all");
  const [isExporting, setIsExporting] = useState(false);

  const handleExportSummary = () => {
    setIsExporting(true);
    try {
      const rows = [
        ["Metric", "Value"],
        ["Total Rooms", String(base.totalRooms)],
        ["Total Residents", String(base.totalResidents)],
        ["Occupied Beds", `${base.occupiedBeds} / ${base.totalBeds}`],
        ["Available Beds", String(Math.max(0, base.totalBeds - base.occupiedBeds))],
        [
          "Occupancy Rate",
          `${base.totalBeds > 0 ? Math.round((base.occupiedBeds / base.totalBeds) * 100) : 0}%`,
        ],
        ["Monthly Revenue", String(base.monthlyRevenue)],
        ["Pending Dues", String(base.pendingAmount)],
        ["Monthly Expenses", String(base.monthlyExpenses)],
        ["Net Cash Flow", String(base.monthlyRevenue - base.monthlyExpenses)],
      ];
      downloadCSV("hostel_analytics_summary.csv", toCSV(["Metric", "Value"], rows.slice(1)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs & Quick Action Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex items-center gap-1 overflow-x-auto rounded-xl border border-surface-border bg-neutral-100/80 p-1"
          role="tablist"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  active
                    ? "shadow-xs bg-white text-neutral-900 ring-1 ring-black/5"
                    : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
                )}
              >
                <Icon size={14} className={active ? "text-brand-ink" : "text-neutral-400"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSummary}
            disabled={isExporting}
            className="gap-1.5 text-xs font-semibold text-neutral-700"
            title="Download executive metrics summary"
          >
            <Download size={14} />
            Export Summary
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={loading}
            className="gap-1.5 text-xs font-semibold text-neutral-700"
            title="Refresh analytics data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
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
          description="Live owner data failed to load. Please verify your network connection and try again."
          onRetry={onRetry}
        />
      ) : empty ? (
        <EmptyState
          title="No analytics yet"
          description="Add rooms and residents to unlock real-time business telemetry and insights for your hostel."
        />
      ) : (
        <div className="space-y-6">
          {/* Executive Spotlight */}
          <ExecutiveSpotlight base={base} />

          {/* Key Metrics Grid */}
          <KpiGrid base={base} />

          {/* Tab View: Full Dashboard */}
          {activeTab === "all" && (
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Occupancy & Financial Overview
                  </h3>
                  <span className="text-xs text-neutral-400">Live Telemetry</span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <OccupancySection base={base} />
                  <RevenueSection base={base} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Room Capacity & Inventory Dynamics
                  </h3>
                  <span className="text-xs text-neutral-400">Capacity Telemetry</span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <RoomSection base={base} />
                  <CapacitySection base={base} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Growth Trends & Resident Movement
                  </h3>
                  <span className="text-xs text-neutral-400">Cohort Insights</span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <GrowthSection base={base} />
                  <MovementSection base={base} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Cash Flow, Expenses & Invoicing
                  </h3>
                  <span className="text-xs text-neutral-400">Ledger Metrics</span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <PaymentSection base={base} />
                  <ExpenseSection base={base} />
                </div>
                <RevExpSection base={base} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Demographics & Maintenance Performance
                  </h3>
                  <span className="text-xs text-neutral-400">Operations & Hygiene</span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <DemographicsSection base={base} />
                  <PerformanceSection base={base} />
                </div>
              </div>
            </div>
          )}

          {/* Tab View: Financials */}
          {activeTab === "financials" && (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <RevenueSection base={base} />
                <PaymentSection base={base} />
              </div>
              <RevExpSection base={base} />
              <div className="grid gap-4 xl:grid-cols-2">
                <ExpenseSection base={base} />
                <PerformanceSection base={base} />
              </div>
            </div>
          )}

          {/* Tab View: Occupancy */}
          {activeTab === "occupancy" && (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <OccupancySection base={base} />
                <RoomSection base={base} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <CapacitySection base={base} />
                <MovementSection base={base} />
              </div>
            </div>
          )}

          {/* Tab View: Operations */}
          {activeTab === "operations" && (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <GrowthSection base={base} />
                <MovementSection base={base} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <DemographicsSection base={base} />
                <PerformanceSection base={base} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
