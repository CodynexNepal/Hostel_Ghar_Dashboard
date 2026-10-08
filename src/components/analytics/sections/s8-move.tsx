"use client";
import { useMemo } from "react";
import { ChartShell } from "../chart-core";
import { HBarList } from "../chart-parts";
import { GroupBars } from "../chart-bars";
import { PALETTE, Legend } from "../charts";
import { Insight } from "../chart-misc";
import { downloadCSV, toCSV, type AnalyticsBase } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
/**
 * Owner-scoped fee activity — real check-in proxy from fee creation dates is
 * unavailable, so this renders the real monthly billed/collected volume from
 * the fee ledger (honest zeros). No invented 78 check-ins / transfers.
 */
export function MovementSection({ base }: { base: AnalyticsBase }) {
  const fees = useMemo(() => base.fees ?? [], [base.fees]);
  const data = useMemo(() => {
    const num = (v: unknown): number => {
      const n = typeof v === "string" ? Number(v) : (v as number);
      return Number.isFinite(n) ? (n as number) : 0;
    };
    const billedOf = (f: (typeof fees)[number]): number => {
      for (const c of [f.totalPayable, f.dueAmount, f.amount, f.paidAmount]) {
        const n = num(c);
        if (n > 0) return n;
      }
      return 0;
    };
    const collectedOf = (f: (typeof fees)[number]): number => {
      const p = num(f.paidAmount);
      if (p > 0) return Math.min(p, billedOf(f) || p);
      return String(f.status ?? "").toUpperCase() === "PAID" ? billedOf(f) : 0;
    };
    const MON = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const acc = new Map<
      string,
      { label: string; billed: number; collected: number; key: number }
    >();
    for (const f of fees) {
      const bm = num(f.billingMonth);
      const by = num(f.billingYear);
      let y = 0;
      let m = 0;
      if (bm >= 1 && bm <= 12 && by > 0) {
        y = by;
        m = bm;
      } else {
        const raw = f.createdAt || f.dueDate || "";
        const d = raw ? new Date(raw) : null;
        if (!d || Number.isNaN(d.getTime())) continue;
        y = d.getFullYear();
        m = d.getMonth() + 1;
      }
      const id = `${y}-${m}`;
      const cur = acc.get(id) ?? {
        label: `${MON[m - 1]} ${y}`,
        billed: 0,
        collected: 0,
        key: y * 12 + m,
      };
      cur.billed += billedOf(f);
      cur.collected += collectedOf(f);
      acc.set(id, cur);
    }
    return [...acc.values()].sort((a, b) => a.key - b.key).slice(-8);
  }, [fees]);
  if (fees.length === 0) {
    return (
      <ChartShell title="Billing activity" subtitle="No fee ledger yet">
        <EmptyState
          title="No billing yet"
          description="Generate monthly fees to see billed vs collected per month."
        />
      </ChartShell>
    );
  }
  const billed = data.reduce((a, d) => a + d.billed, 0);
  const collected = data.reduce((a, d) => a + d.collected, 0);
  return (
    <ChartShell
      title="Billing activity"
      subtitle={`${formatCurrency(collected)} collected of ${formatCurrency(billed)} billed · live ledger`}
      onExport={() =>
        downloadCSV(
          "billing.csv",
          toCSV(
            ["month", "billed", "collected"],
            data.map((d) => [d.label, d.billed, d.collected])
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
      <GroupBars
        labels={data.map((d) => d.label)}
        groups={[
          { color: PALETTE.ink, label: "Collected", values: data.map((d) => d.collected) },
          { color: PALETTE.amber, label: "Billed", values: data.map((d) => d.billed) },
        ]}
        formatY={(v) => formatCurrency(v)}
      />
      <div className="mt-2">
        <HBarList
          rows={data.slice(-4).map((d) => ({
            label: d.label,
            value: d.collected,
            sub: `of ${formatCurrency(d.billed)}`,
          }))}
          formatV={(v) => formatCurrency(v)}
        />
      </div>
      <Insight
        tone="info"
        title="Live billing only."
        body="Every bar comes from GET /fees/hostels/:id rows — no modeled check-ins."
      />
    </ChartShell>
  );
}
