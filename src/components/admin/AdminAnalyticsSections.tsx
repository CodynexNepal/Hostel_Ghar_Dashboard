"use client";

import { useMemo, useState } from "react";
import { ChartShell, AreaLines } from "@/components/analytics/chart-core";
import { Donut, Insight } from "@/components/analytics/chart-misc";
import { GroupBars } from "@/components/analytics/chart-bars";
import { Legend, PALETTE, Segmented } from "@/components/analytics/charts";
import { downloadCSV, toCSV } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { AdminSummaryWithCounts } from "@/lib/hostelGhar";
import type { RevenueTrendPoint } from "@/lib/api-types";
import type { Hostel } from "@/types/hostel";
import {
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  DollarSign,
  GraduationCap,
  TrendingUp,
  Users,
  Wallet,
  AlertTriangle,
} from "lucide-react";

export type RangeKey = "today" | "7d" | "30d" | "3m" | "6m" | "1y" | "custom";
type TrendMode = "monthly" | "yearly";

function trendValues(trend: RevenueTrendPoint[] | undefined, mode: TrendMode) {
  const list = Array.isArray(trend) ? trend : [];
  const rows = list.map((t) => ({
    label: String(t.label ?? ""),
    collected: Number(t.collected ?? 0),
    billed: Number(t.billed ?? t.collected ?? 0),
  }));
  return mode === "yearly" ? rows.slice(-24) : rows.slice(-12);
}

function sliceByRange<T>(rows: T[], range: RangeKey): T[] {
  if (range === "today" || range === "7d") return rows.slice(-3);
  if (range === "30d") return rows.slice(-6);
  if (range === "3m") return rows.slice(-6);
  if (range === "6m") return rows.slice(-12);
  return rows.slice(-24);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. Revenue Analytics: Monthly Trend & Overview
 * ───────────────────────────────────────────────────────────────────────────── */
export function PlatformRevenueSection({
  summary,
  range = "1y",
  isLoading = false,
}: {
  summary: AdminSummaryWithCounts | null;
  range?: RangeKey;
  isLoading?: boolean;
}) {
  const [mode, setMode] = useState<TrendMode>("monthly");
  const data = useMemo(
    () => sliceByRange(trendValues(summary?.revenueTrend, mode), range),
    [summary, mode, range]
  );
  const tot = data.reduce((a, d) => a + d.collected, 0);
  const billed = data.reduce((a, d) => a + d.billed, 0);

  if (isLoading) {
    return <CardSkeleton className="min-h-[320px]" />;
  }

  if (data.length === 0) {
    return (
      <ChartShell title="Revenue Trends" subtitle="No revenue buckets yet">
        <EmptyState
          title="No revenue data yet"
          description="The admin summary hasn't reported a revenue trend. Once fees and payments flow, the curve appears here."
        />
      </ChartShell>
    );
  }

  return (
    <ChartShell
      title="Monthly Revenue Trends"
      subtitle={`${formatCurrency(tot)} collected · ${data.length} periods · Verified`}
      filters={
        <Segmented
          label="Revenue granularity"
          value={mode}
          onChange={setMode}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
        />
      }
      onExport={() =>
        downloadCSV(
          `revenue-trends-${mode}.csv`,
          toCSV(
            ["period", "collected", "billed"],
            data.map((d) => [d.label, d.collected, d.billed])
          )
        )
      }
      footer={
        <Legend
          items={[
            { color: PALETTE.ink, label: "Revenue Collected" },
            { color: PALETTE.amber, label: "Billed Receivables" },
          ]}
        />
      }
    >
      <AreaLines
        labels={data.map((d) => d.label)}
        series={[
          { color: PALETTE.ink, values: data.map((d) => d.collected) },
          { color: PALETTE.amber, values: data.map((d) => Math.max(0, d.billed - d.collected)) },
        ]}
        formatY={(v) => formatCurrency(v)}
      />
      <Insight
        tone={billed - tot > 0 ? "warn" : "good"}
        title={
          billed - tot > 0
            ? `${formatCurrency(billed - tot)} outstanding in this period.`
            : "100% collected."
        }
        body={
          billed - tot > 0
            ? "Billed amounts exceed collected cash — review overdue balances across hostels."
            : "All billed revenue for this time window has been successfully received."
        }
      />
    </ChartShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. Revenue Analytics: Daily Revenue Collection
 * ───────────────────────────────────────────────────────────────────────────── */
export function DailyRevenueSection({
  summary,
  isLoading = false,
}: {
  summary: AdminSummaryWithCounts | null;
  isLoading?: boolean;
}) {
  const daily = summary?.dailyRevenue ?? [];

  if (isLoading) {
    return <CardSkeleton className="min-h-[300px]" />;
  }

  if (daily.length === 0) {
    return (
      <ChartShell title="Daily Revenue Collection" subtitle="Real-time cashflow">
        <EmptyState
          title="No daily payments recorded yet"
          description="As payments are verified, day-by-day cashflow appears here."
        />
      </ChartShell>
    );
  }

  const totalDaily = daily.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <ChartShell
      title="Daily Revenue Collection (Last 30 Days)"
      subtitle={`${formatCurrency(totalDaily)} collected over ${daily.length} days`}
      onExport={() =>
        downloadCSV(
          "daily-revenue.csv",
          toCSV(
            ["date", "collected"],
            daily.map((d) => [d.date, d.amount])
          )
        )
      }
      footer={<Legend items={[{ color: "#C3FF7D", label: "Daily Collections" }]} />}
    >
      <GroupBars
        labels={daily.map((d) => d.date.slice(5))}
        groups={[
          {
            color: "#010101",
            label: "Daily Collection",
            values: daily.map((d) => Number(d.amount)),
          },
        ]}
        formatY={(v) => formatCurrency(v)}
      />
    </ChartShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. Payment Methods Breakdown (Online vs Cash) & Invoice Lifecycle
 * ───────────────────────────────────────────────────────────────────────────── */
export function PaymentMethodsAndStatusSection({
  summary,
  isLoading = false,
}: {
  summary: AdminSummaryWithCounts | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <CardSkeleton className="min-h-[320px]" />;
  }

  const pm = summary?.paymentMethods;
  const cashAmount = pm?.cashAmount ?? 0;
  const onlineAmount = pm?.onlineAmount ?? 0;
  const total = cashAmount + onlineAmount;

  const feeLife = summary?.feeLifecycle ?? {
    total: 0,
    paid: summary?.paidFees ?? 0,
    partiallyPaid: 0,
    pending: summary?.pendingFees ?? 0,
    overdue: summary?.overdueFees ?? 0,
  };

  const methodSlices = [
    { label: "Cash", color: PALETTE.ink, value: cashAmount, display: formatCurrency(cashAmount) },
    {
      label: "Online (eSewa/Khalti/Bank)",
      color: "#C3FF7D",
      value: onlineAmount,
      display: formatCurrency(onlineAmount),
    },
  ];

  const statusSlices = [
    { label: "Paid", color: PALETTE.ink, value: feeLife.paid, display: String(feeLife.paid) },
    {
      label: "Partially Paid",
      color: PALETTE.blue,
      value: feeLife.partiallyPaid ?? 0,
      display: String(feeLife.partiallyPaid ?? 0),
    },
    {
      label: "Pending",
      color: PALETTE.amber,
      value: feeLife.pending,
      display: String(feeLife.pending),
    },
    {
      label: "Overdue",
      color: PALETTE.red,
      value: feeLife.overdue,
      display: String(feeLife.overdue),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Online vs Cash */}
      <ChartShell
        title="Payment Methods (Cash vs Online)"
        subtitle={`${formatCurrency(total)} verified payments`}
        footer={
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-neutral-800">
              <span className="h-2 w-2 rounded-full bg-neutral-900" />
              Cash: {formatCurrency(cashAmount)} ({pm?.cashPercent ?? 0}%)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-neutral-800">
              <span className="h-2 w-2 rounded-full bg-[#9edc51]" />
              Online: {formatCurrency(onlineAmount)} ({pm?.onlinePercent ?? 0}%)
            </span>
          </div>
        }
      >
        <Donut
          centerTop={`${pm?.onlinePercent ?? 0}%`}
          centerBottom="Online Share"
          slices={methodSlices}
        />
        <Insight
          tone="info"
          title="Digital payment adoption"
          body={`${pm?.onlineCount ?? 0} online transactions vs ${pm?.cashCount ?? 0} physical cash entries recorded.`}
        />
      </ChartShell>

      {/* Invoice Status Lifecycle */}
      <ChartShell
        title="Invoice Status Distribution"
        subtitle={`${feeLife.total || feeLife.paid + (feeLife.partiallyPaid ?? 0) + feeLife.pending + feeLife.overdue} total bills`}
        footer={
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="font-medium text-neutral-800">Paid: {feeLife.paid}</span>
            <span className="font-medium text-blue-700">Partial: {feeLife.partiallyPaid ?? 0}</span>
            <span className="font-medium text-amber-700">Pending: {feeLife.pending}</span>
            <span className="font-medium text-red-700">Overdue: {feeLife.overdue}</span>
          </div>
        }
      >
        <Donut
          centerTop={String(feeLife.paid)}
          centerBottom="Settled Bills"
          slices={statusSlices}
        />
        <Insight
          tone={feeLife.overdue > 0 ? "warn" : "good"}
          title={feeLife.overdue > 0 ? `${feeLife.overdue} overdue bills` : "Zero overdue bills"}
          body={
            feeLife.overdue > 0
              ? "Follow up with students past their invoice deadline."
              : "All active invoices are in good standing."
          }
        />
      </ChartShell>
    </div>
  );
}

/** Legacy/convenience export for the main admin dashboard page. */
export function PlatformPaymentSection({
  summary,
  isLoading = false,
}: {
  summary: AdminSummaryWithCounts | null;
  isLoading?: boolean;
}) {
  return <PaymentMethodsAndStatusSection summary={summary} isLoading={isLoading} />;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. Hostel Analytics: Leaderboard & Distribution
 * ───────────────────────────────────────────────────────────────────────────── */
export function HostelAnalyticsSection({
  summary,
  hostels,
  onSelectHostel,
}: {
  summary: AdminSummaryWithCounts | null;
  hostels: Hostel[];
  onSelectHostel?: (hostelId: string) => void;
}) {
  const ha = summary?.hostelsAnalytics;
  const topRevenue = ha?.topPerforming ?? [];
  const highDues = ha?.highestOutstanding ?? [];
  const dist = ha?.studentDistribution ?? [];
  const regTrends = ha?.registrationTrends ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top-performing Hostels */}
        <Card className="p-5">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <div>
              <h4 className="font-semibold text-neutral-900">Top Performing Hostels</h4>
              <p className="text-xs text-neutral-500">Highest revenue collected</p>
            </div>
            <Badge tone="green">Revenue Leaders</Badge>
          </div>
          <div className="mt-4 divide-y divide-surface-border">
            {topRevenue.length === 0 ? (
              <p className="py-4 text-center text-xs text-neutral-400">No collection records yet</p>
            ) : (
              topRevenue.map((h, i) => (
                <div
                  key={h.hostelId}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-2.5 text-xs transition hover:bg-neutral-50"
                  onClick={() => onSelectHostel?.(h.hostelId)}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 font-bold text-neutral-700">
                      {i + 1}
                    </span>
                    <span className="font-medium text-neutral-900">{h.name}</span>
                  </div>
                  <span className="font-bold text-neutral-900">{formatCurrency(h.collected)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Hostels with Highest Outstanding Dues */}
        <Card className="p-5">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <div>
              <h4 className="font-semibold text-neutral-900">Highest Outstanding Dues</h4>
              <p className="text-xs text-neutral-500">Uncollected & overdue balances</p>
            </div>
            <Badge tone="amber">Action Needed</Badge>
          </div>
          <div className="mt-4 divide-y divide-surface-border">
            {highDues.length === 0 ? (
              <p className="py-4 text-center text-xs text-neutral-400">Zero outstanding dues</p>
            ) : (
              highDues.map((h, i) => (
                <div
                  key={h.hostelId}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-2.5 text-xs transition hover:bg-neutral-50"
                  onClick={() => onSelectHostel?.(h.hostelId)}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 font-bold text-amber-700">
                      {i + 1}
                    </span>
                    <span className="font-medium text-neutral-900">{h.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-amber-600">
                      {formatCurrency(h.outstanding)}
                    </span>
                    {h.overdue > 0 && (
                      <span className="text-[11px] font-medium text-red-600">
                        Overdue: {formatCurrency(h.overdue)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Hostel Status & Registration Trends */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h4 className="font-semibold text-neutral-900">Hostel Operational Status</h4>
          <p className="text-xs text-neutral-500">Active resident occupancy</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              <span className="font-semibold">Active Hostels (With Residents)</span>
              <span className="text-base font-bold">{ha?.activeHostels ?? hostels.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-neutral-100 p-3 text-xs text-neutral-700">
              <span className="font-semibold">Inactive / Empty Hostels</span>
              <span className="text-base font-bold">{ha?.inactiveHostels ?? 0}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h4 className="font-semibold text-neutral-900">Hostel Registration Trends</h4>
          <p className="text-xs text-neutral-500">New hostels onboarded over last 12 months</p>
          {regTrends.length === 0 ? (
            <p className="mt-6 text-center text-xs text-neutral-400">No trend data yet</p>
          ) : (
            <div className="mt-4">
              <GroupBars
                labels={regTrends.map((t) => t.period)}
                groups={[
                  {
                    color: PALETTE.ink,
                    label: "New Hostels",
                    values: regTrends.map((t) => t.count),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. Student Analytics: Registrations & Outstanding Balances
 * ───────────────────────────────────────────────────────────────────────────── */
export function StudentAnalyticsSection({ summary }: { summary: AdminSummaryWithCounts | null }) {
  const sa = summary?.studentAnalytics;
  const growth = sa?.growthTrends ?? [];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Student Analytics & Health</h3>
          <p className="text-xs text-neutral-500">
            Resident growth, active registrations, and balance health
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge tone="green">Active: {sa?.totalActive ?? summary?.totalResidents ?? 0}</Badge>
          <Badge tone="neutral">
            Lifetime Registered: {sa?.totalRegistered ?? summary?.totalResidents ?? 0}
          </Badge>
          <Badge tone="amber">With Outstanding Dues: {sa?.withOutstandingBalance ?? 0}</Badge>
          <Badge tone="danger">With Overdue Dues: {sa?.withOverdueBalance ?? 0}</Badge>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Monthly Student Registration Growth
        </h4>
        {growth.length === 0 ? (
          <p className="py-8 text-center text-xs text-neutral-400">
            No registration history recorded yet
          </p>
        ) : (
          <div className="mt-3">
            <GroupBars
              labels={growth.map((g) => g.period)}
              groups={[
                {
                  color: "#010101",
                  label: "New Students",
                  values: growth.map((g) => g.count),
                },
              ]}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. Top Hostels Table / Selector
 * ───────────────────────────────────────────────────────────────────────────── */
export function TopHostelsSection({
  hostels,
  onOpen,
}: {
  hostels: Hostel[];
  onOpen?: (hostelId: string) => void;
}) {
  const sorted = useMemo(
    () => [...hostels].sort((a, b) => (b.occupiedBeds || 0) - (a.occupiedBeds || 0)).slice(0, 10),
    [hostels]
  );

  if (sorted.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between border-b border-surface-border pb-3">
        <div>
          <h4 className="font-semibold text-neutral-900">All Hostels Inventory</h4>
          <p className="text-xs text-neutral-500">Click a hostel to isolate its metrics</p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-surface-border">
        {sorted.map((h) => {
          const occ = h.totalBeds ? Math.round(((h.occupiedBeds || 0) / h.totalBeds) * 100) : 0;
          return (
            <div
              key={h.id}
              onClick={() => onOpen?.(h.id)}
              className="flex cursor-pointer items-center justify-between rounded px-2 py-2 text-xs transition hover:bg-neutral-50"
            >
              <div>
                <span className="font-medium text-neutral-900">{h.name}</span>
                <span className="ml-2 text-neutral-400">{h.city || "Nepal"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-neutral-600">
                  {h.occupiedBeds || 0} / {h.totalBeds || 0} beds
                </span>
                <Badge tone={occ >= 75 ? "green" : "neutral"}>{occ}%</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function PlatformOccupancySection({ hostels }: { hostels: Hostel[] }) {
  const rows = useMemo(() => {
    return hostels
      .map((h) => ({
        label: h.name,
        occupied: Math.max(0, h.occupiedBeds || 0),
        total: typeof h.totalBeds === "number" ? h.totalBeds : null,
      }))
      .filter(
        (r): r is { label: string; occupied: number; total: number } =>
          r.total !== null && r.total > 0
      )
      .slice(0, 10);
  }, [hostels]);

  if (rows.length === 0) {
    return (
      <ChartShell title="Occupancy by hostel" subtitle="No capacity data yet">
        <EmptyState
          title="No occupancy yet"
          description="Hostel rows don't report bed capacity yet."
        />
      </ChartShell>
    );
  }

  return (
    <ChartShell
      title="Occupancy by Hostel"
      subtitle="Beds occupied vs capacity"
      footer={<Legend items={[{ color: PALETTE.ink, label: "Occupied Beds" }]} />}
    >
      <GroupBars
        labels={rows.map((r) => r.label)}
        groups={[
          {
            color: PALETTE.ink,
            label: "Occupied Beds",
            values: rows.map((r) => r.occupied),
          },
        ]}
      />
    </ChartShell>
  );
}

export function PlatformPlanMixSection({ summary }: { summary: AdminSummaryWithCounts | null }) {
  const stats = summary?.stats;
  const paid = stats?.mrrPaidPlans ?? 0;
  const free = stats?.mrrFreePlans ?? 0;
  const lapsed = stats?.mrrLapsedPlans ?? 0;

  if (paid + free + lapsed === 0) {
    return null;
  }

  return (
    <ChartShell title="Subscription Plan Distribution" subtitle="Active tier split">
      <Donut
        centerTop={String(paid + free)}
        centerBottom="Subscribers"
        slices={[
          { color: PALETTE.ink, label: "Paid Subscriptions", value: paid },
          { color: PALETTE.blue, label: "Free Tier", value: free },
          { color: PALETTE.amber, label: "Lapsed", value: lapsed },
        ]}
      />
    </ChartShell>
  );
}
