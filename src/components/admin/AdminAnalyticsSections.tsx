"use client";

import { useMemo, useState } from "react";
import { ChartShell, AreaLines } from "@/components/analytics/chart-core";
import { Donut, Insight } from "@/components/analytics/chart-misc";
import { GroupBars } from "@/components/analytics/chart-bars";
import { Legend, PALETTE, Segmented } from "@/components/analytics/charts";
import { downloadCSV, toCSV } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AdminSummaryWithCounts } from "@/lib/hostelGhar";
import type { RevenueTrendPoint } from "@/lib/api-types";
import type { Hostel } from "@/types/hostel";

export type RangeKey = "30d" | "3m" | "6m" | "1y";
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
  if (range === "30d") return rows.slice(-6);
  if (range === "3m") return rows.slice(-6);
  if (range === "6m") return rows.slice(-12);
  return rows.slice(-24);
}

/** Platform revenue — live `revenueTrend` buckets from admin summary. */
export function PlatformRevenueSection({
  summary,
  range,
}: {
  summary: AdminSummaryWithCounts | null;
  range: RangeKey;
}) {
  const [mode, setMode] = useState<TrendMode>("monthly");
  const data = useMemo(
    () => sliceByRange(trendValues(summary?.revenueTrend, mode), range),
    [summary, mode, range]
  );
  const tot = data.reduce((a, d) => a + d.collected, 0);
  const billed = data.reduce((a, d) => a + d.billed, 0);
  if (data.length === 0) {
    return (
      <ChartShell title="Platform revenue" subtitle="No revenue buckets yet">
        <EmptyState
          title="No revenue data yet"
          description="The admin summary hasn't reported a revenue trend. Once subscriptions and fees flow, the collected curve appears here."
        />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title="Platform revenue"
      subtitle={`${formatCurrency(tot)} collected · ${data.length} buckets · live`}
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
          `platform-revenue-${mode}.csv`,
          toCSV(
            ["label", "collected", "billed"],
            data.map((d) => [d.label, d.collected, d.billed])
          )
        )
      }
      footer={
        <Legend
          items={[
            { color: PALETTE.ink, label: "Collected" },
            { color: PALETTE.amber, label: "Billed" },
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
          billed - tot > 0 ? `${formatCurrency(billed - tot)} unbilled gap.` : "Fully collected."
        }
        body={
          billed - tot > 0
            ? "Billed exceeds collected in this window — chase overdue invoices first."
            : "Every billed rupee in this window is collected."
        }
      />
    </ChartShell>
  );
}

/** Fee lifecycle donut — live fee counts from admin summary. */
export function PlatformPaymentSection({ summary }: { summary: AdminSummaryWithCounts | null }) {
  const counts = summary?.feeCounts;
  const paid = counts?.paid ?? summary?.paidFees ?? 0;
  const partial = counts?.partial ?? 0;
  const pending = counts?.pending ?? summary?.pendingFees ?? 0;
  const overdue = counts?.overdue ?? summary?.overdueFees ?? 0;
  const total = paid + partial + pending + overdue;
  if (!counts && total === 0) {
    return (
      <ChartShell title="Fee lifecycle" subtitle="No fee counts yet">
        <EmptyState
          title="No fee data yet"
          description="Once hostels generate monthly fees, paid / pending / overdue splits appear here."
        />
      </ChartShell>
    );
  }
  const coll = total > 0 ? Math.round(((paid + partial * 0.5) / total) * 1000) / 10 : 0;
  const colors = [PALETTE.ink, PALETTE.blue, PALETTE.amber, PALETTE.red];
  const slices = [
    { label: "Paid", count: paid },
    { label: "Partially paid", count: partial },
    { label: "Pending", count: pending },
    { label: "Overdue", count: overdue },
  ];
  return (
    <ChartShell
      title="Fee lifecycle"
      subtitle={`${coll}% healthy · ${total} invoices · live`}
      onExport={() =>
        downloadCSV(
          "platform-fee-lifecycle.csv",
          toCSV(
            ["status", "invoices"],
            slices.map((s) => [s.label, s.count])
          )
        )
      }
      footer={<p>Only 4 lifecycle states — paid, partial, pending, overdue.</p>}
    >
      <Donut
        centerTop={`${coll}%`}
        centerBottom="healthy"
        slices={slices.map((s, i) => ({
          color: colors[i] ?? PALETTE.ink,
          label: s.label,
          value: Math.max(1, s.count),
          display: String(s.count),
        }))}
      />
      <Insight
        tone={coll >= 75 ? "good" : coll >= 55 ? "warn" : "bad"}
        title={coll >= 75 ? "Collection health is strong." : "Collection needs a push."}
        body={`${overdue} overdue + ${pending} pending invoices need follow-up across the platform.`}
      />
    </ChartShell>
  );
}

/** Occupancy by hostel — live hostel rows (occupied/total beds). */
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
          description="Hostel rows don't report bed capacity yet. The platform occupancy KPI above still reflects the admin summary."
        />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title="Occupancy by hostel"
      subtitle={`Top ${rows.length} hostels · live from /admin/hostels`}
      onExport={() =>
        downloadCSV(
          "platform-occupancy.csv",
          toCSV(
            ["hostel", "occupied", "capacity"],
            rows.map((r) => [r.label, r.occupied, r.total])
          )
        )
      }
      footer={
        <Legend
          items={[
            { color: PALETTE.ink, label: "Occupied beds" },
            { color: PALETTE.limeDark, label: "Available beds" },
          ]}
        />
      }
    >
      <GroupBars
        labels={rows.map((r) => (r.label.length > 14 ? r.label.slice(0, 13) + "…" : r.label))}
        groups={[
          { color: PALETTE.ink, label: "Occupied", values: rows.map((r) => r.occupied) },
          {
            color: PALETTE.limeDark,
            label: "Available",
            values: rows.map((r) => Math.max(0, r.total - r.occupied)),
          },
        ]}
      />
    </ChartShell>
  );
}

/** Subscription plan mix — live paid/free/lapsed plan counts. */
export function PlatformPlanMixSection({ summary }: { summary: AdminSummaryWithCounts | null }) {
  const paid = summary?.stats?.mrrPaidPlans ?? 0;
  const free = summary?.stats?.mrrFreePlans ?? 0;
  const lapsed = summary?.stats?.mrrLapsedPlans ?? 0;
  const total = paid + free + lapsed;
  if (total === 0) {
    return (
      <ChartShell title="Plan mix" subtitle="No plan data yet">
        <EmptyState
          title="No plan mix yet"
          description="The admin summary hasn't reported paid / free / lapsed plan counts."
        />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title="Plan mix"
      subtitle={`${total} hostels on plans · live`}
      footer={<p>Paid plans drive MRR — lapsed plans are re-activation targets.</p>}
    >
      <Donut
        centerTop={`${paid}`}
        centerBottom="paid plans"
        slices={[
          { color: PALETTE.ink, label: "Paid", value: Math.max(1, paid), display: String(paid) },
          {
            color: PALETTE.limeDark,
            label: "Free",
            value: Math.max(1, free),
            display: String(free),
          },
          {
            color: PALETTE.red,
            label: "Lapsed",
            value: Math.max(1, lapsed),
            display: String(lapsed),
          },
        ]}
      />
    </ChartShell>
  );
}

/** Top hostels by residents — live leaderboard from /admin/hostels. */
export function TopHostelsSection({
  hostels,
  onOpen,
}: {
  hostels: Hostel[];
  onOpen: (id: string) => void;
}) {
  const rows = useMemo(
    () =>
      [...hostels]
        .sort((a, b) => (b.occupiedBeds || 0) - (a.occupiedBeds || 0))
        .slice(0, 8)
        .map((h) => ({
          label: h.name,
          value: Math.max(0, h.occupiedBeds || 0),
          sub: h.city || h.ownerName || undefined,
          id: h.id,
        })),
    [hostels]
  );
  if (rows.length === 0) {
    return (
      <ChartShell title="Top hostels" subtitle="No hostel rows yet">
        <EmptyState
          title="No hostels yet"
          description="Create the first hostel to seed the leaderboard."
        />
      </ChartShell>
    );
  }
  const max = Math.max(1, rows[0]?.value ?? 1);
  return (
    <ChartShell
      title="Top hostels by residents"
      subtitle={`${rows.length} shown · click a row to filter the page`}
      onExport={() =>
        downloadCSV(
          "top-hostels.csv",
          toCSV(
            ["hostel", "residents"],
            rows.map((r) => [r.label, r.value])
          )
        )
      }
    >
      <div className="space-y-3">
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpen(r.id)}
            className="w-full text-left"
            aria-label={`Filter analytics to ${r.label}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-neutral-700 underline-offset-2 hover:underline">
                {r.label}
                {r.sub && <span className="text-neutral-400"> · {r.sub}</span>}
              </span>
              <span className="font-bold tabular-nums text-neutral-900">{r.value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand-ink transition-[width] duration-500"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </ChartShell>
  );
}
