"use client";
import { useMemo } from "react";
import { ChartShell, AreaLines } from "../chart-core";
import { ChartShell as Shell2 } from "../chart-core";
import { StackedBars } from "../chart-parts";
import { Insight } from "../chart-misc";
import { Legend, PALETTE } from "../charts";
import { downloadCSV, toCSV, type AnalyticsBase } from "@/lib/analytics";
import { expenseTotal, feeBilled, feeCollected, groupExpensesByMonth } from "@/lib/analytics-live";
import { revenueSeries } from "@/lib/analytics-series";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
/**
 * Owner-scoped revenue vs expenses — summary trend / fee ledger for revenue,
 * GET /expenses monthly groups for costs. Empty sources → empty state.
 */
export function RevExpSection({ base }: { base: AnalyticsBase }) {
  const rev = useMemo(
    () => revenueSeries(base, "monthly", "rev-exp", base.liveTrend, base.fees),
    [base]
  );
  const costMonths = useMemo(() => groupExpensesByMonth(base.expenses ?? []), [base.expenses]);
  const costByLabel = useMemo(
    () => new Map(costMonths.map((m) => [m.label, m.total])),
    [costMonths]
  );
  const revByLabel = useMemo(() => new Map(rev.map((r) => [r.label, r.total])), [rev]);
  const allLabels = useMemo(() => {
    const list: string[] = [];
    rev.forEach((r) => {
      if (!list.includes(r.label)) list.push(r.label);
    });
    costMonths.forEach((c) => {
      if (!list.includes(c.label)) list.push(c.label);
    });
    return list;
  }, [rev, costMonths]);

  const data = useMemo(() => {
    const costOf = (label: string): number => {
      if (costByLabel.has(label)) return costByLabel.get(label) ?? 0;
      const short = label.split(" ")[0];
      const hit = costMonths.find((m) => m.label.startsWith(short));
      return hit ? hit.total : 0;
    };

    return allLabels.map((label) => {
      const revenue = revByLabel.get(label) ?? 0;
      const expenses = costOf(label);
      return {
        label,
        revenue,
        expenses,
        net: revenue - expenses,
      };
    });
  }, [allLabels, revByLabel, costByLabel, costMonths]);

  const hasRev = rev.some((r) => r.total > 0);
  const hasCost = costMonths.some((m) => m.total > 0);

  if (!hasRev && !hasCost) {
    return (
      <ChartShell title="Revenue vs expenses" subtitle="No revenue or expenses yet">
        <EmptyState
          title="Nothing to compare yet"
          description="Generate fees and record expenses to compare them here."
        />
      </ChartShell>
    );
  }
  const neg = data.filter((d) => d.net < 0 && (d.revenue > 0 || d.expenses > 0));
  return (
    <ChartShell
      title="Revenue vs expenses"
      subtitle={neg.length ? `${neg.length} months ran at a loss` : "Live revenue vs live expenses"}
      onExport={() =>
        downloadCSV(
          "rev-exp.csv",
          toCSV(
            ["label", "revenue", "expenses", "net"],
            data.map((d) => [d.label, d.revenue, d.expenses, d.net])
          )
        )
      }
      footer={
        <Legend
          items={[
            { color: PALETTE.ink, label: "Revenue" },
            { color: PALETTE.red, label: "Expenses" },
            { color: PALETTE.limeDark, label: "Net" },
          ]}
        />
      }
    >
      <AreaLines
        labels={data.map((d) => d.label)}
        series={[
          { color: PALETTE.ink, values: data.map((d) => d.revenue) },
          { color: PALETTE.red, values: data.map((d) => d.expenses) },
          { color: PALETTE.limeDark, values: data.map((d) => Math.max(0, d.net)) },
        ]}
        formatY={(v) => formatCurrency(v)}
      />
      <Insight
        tone={neg.length ? "bad" : "good"}
        title={
          neg.length
            ? `Loss in ${neg
                .slice(0, 3)
                .map((d) => d.label)
                .join(", ")}.`
            : "Margin is healthy."
        }
        body={
          neg.length
            ? "Costs outran collections those months — review the expense breakdown."
            : `Net across the window: ${formatCurrency(data.reduce((a, d) => a + d.net, 0))}.`
        }
      />
    </ChartShell>
  );
}
/**
 * Owner-scoped bed capacity — derived ONLY from GET /rooms,
 * grouped by floor. No Block A/B/C demo rows.
 */
export function CapacitySection({ base }: { base: AnalyticsBase }) {
  const rooms = useMemo(() => base.rooms ?? [], [base.rooms]);
  const rows = useMemo(() => {
    const byFloor = new Map<
      string,
      { occupied: number; reserved: number; available: number; maintenance: number }
    >();
    for (const r of rooms) {
      const label = r.floor > 0 ? `Floor ${r.floor}` : "No floor";
      const cur = byFloor.get(label) ?? { occupied: 0, reserved: 0, available: 0, maintenance: 0 };
      const cap = Math.max(0, r.capacity || 0);
      const occ = Math.min(cap, Math.max(0, r.occupied || 0));
      const status = String(r.status).toUpperCase();
      if (status === "MAINTENANCE") cur.maintenance += cap;
      else {
        cur.occupied += occ;
        cur.available += Math.max(0, cap - occ);
      }
      byFloor.set(label, cur);
    }
    return [...byFloor.entries()]
      .map(([label, v]) => ({ key: label, label, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rooms]);
  if (rooms.length === 0) {
    return (
      <Shell2 title="Bed capacity" subtitle="No rooms yet">
        <EmptyState
          title="No capacity yet"
          description="Add rooms to see occupied vs available beds per floor."
        />
      </Shell2>
    );
  }
  void feeBilled;
  void feeCollected;
  void expenseTotal;
  return (
    <ChartShell
      title="Bed capacity"
      subtitle="Occupied · available · maintenance — by floor, live from rooms"
      onExport={() =>
        downloadCSV(
          "capacity.csv",
          toCSV(
            ["floor", "occupied", "available", "maint"],
            rows.map((r) => [r.label, r.occupied, r.available, r.maintenance])
          )
        )
      }
      footer={
        <Legend
          items={[
            { color: PALETTE.ink, label: "Occupied" },
            { color: PALETTE.limeDark, label: "Available" },
            { color: PALETTE.red, label: "Maintenance" },
          ]}
        />
      }
    >
      <StackedBars
        labels={rows.map((r) => r.label)}
        stacks={[
          { color: PALETTE.ink, label: "Occupied", values: rows.map((r) => r.occupied) },
          { color: PALETTE.limeDark, label: "Available", values: rows.map((r) => r.available) },
          { color: PALETTE.red, label: "Maintenance", values: rows.map((r) => r.maintenance) },
        ]}
      />
      <Insight
        tone="info"
        title={`${rows.reduce((a, r) => a + r.available, 0)} beds open.`}
        body="Clear maintenance rooms first — every week idle is lost rent."
      />
    </ChartShell>
  );
}
