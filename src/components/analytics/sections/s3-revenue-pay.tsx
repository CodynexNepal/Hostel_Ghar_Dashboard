"use client";
import { useMemo, useState } from "react";
import { ChartShell, AreaLines } from "../chart-core";
import { Donut, Insight } from "../chart-misc";
import { Legend, PALETTE, Segmented } from "../charts";
import {
  downloadCSV,
  formatCompact,
  toCSV,
  type AnalyticsBase,
  type TrendMode,
} from "@/lib/analytics";
import { paymentStatus, revenueSeries } from "@/lib/analytics-series";
import { unpaidCount } from "@/lib/analytics-live";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
export function RevenueSection({ base }: { base: AnalyticsBase }) {
  const [mode, setMode] = useState<TrendMode>("monthly");
  // Owner-scoped live: summary trend buckets win; else the fee ledger buckets.
  // No live source → empty state (never modeled).
  const data = useMemo(
    () => revenueSeries(base, mode, "rev", base.liveTrend, base.fees),
    [base, mode]
  );
  const tot = data.reduce((a, d) => a + d.total, 0);
  const pend = data.reduce((a, d) => a + d.pending, 0);
  const subtitle =
    data.length === 0
      ? "No collections yet"
      : `${formatCurrency(tot)} collected${pend > 0 ? ` · ${formatCurrency(pend)} pending` : ""}`;
  if (data.length === 0) {
    return (
      <ChartShell
        title="Revenue analytics"
        subtitle="No collections yet"
        filters={
          <Segmented
            label="Revenue granularity"
            value={mode}
            onChange={setMode}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        }
      >
        <EmptyState
          title="No revenue yet"
          description="Generate monthly fees to see collections here."
        />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title="Revenue analytics"
      subtitle={subtitle}
      filters={
        <Segmented
          label="Revenue granularity"
          value={mode}
          onChange={setMode}
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
        />
      }
      onExport={() =>
        downloadCSV(
          `revenue-${mode}.csv`,
          toCSV(
            ["label", "rent", "other", "pending", "total"],
            data.map((d) => [d.label, d.rent, d.other, d.pending, d.total])
          )
        )
      }
      footer={
        <Legend
          items={[
            { color: PALETTE.ink, label: "Collected" },
            { color: PALETTE.amber, label: "Pending" },
          ]}
        />
      }
    >
      <AreaLines
        labels={data.map((d) => d.label)}
        series={[
          { color: PALETTE.ink, values: data.map((d) => d.total) },
          { color: PALETTE.amber, values: data.map((d) => d.pending) },
        ]}
        formatY={(v) => formatCurrency(v)}
      />
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        {[
          ["Collected", tot],
          ["Pending", pend],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-surface-muted px-2 py-2">
            <p className="text-[11px] text-neutral-500">{l}</p>
            <p className="text-sm font-bold tabular-nums">{formatCompact(v as number)}</p>
          </div>
        ))}
      </div>
      <Insight
        tone={pend > 0 ? "warn" : "good"}
        title={pend > 0 ? `${formatCurrency(pend)} still open.` : "Fully collected."}
        body={
          pend > 0
            ? "Chase the oldest pending invoices first."
            : "Every billed rupee in this window is collected."
        }
      />
    </ChartShell>
  );
}
export function PaymentSection({ base }: { base: AnalyticsBase }) {
  // Owner-scoped live: summary fee counts win; else the fee ledger.
  // No live source → empty state (never modeled).
  const hasLiveCounts = base.feeCounts !== undefined;
  const hasLedger = (base.fees?.length ?? 0) > 0;
  const slices = useMemo(() => paymentStatus(base, base.feeCounts, base.fees), [base]);
  if (!hasLiveCounts && !hasLedger) {
    return (
      <ChartShell title="Payment status" subtitle="No fee ledger yet">
        <EmptyState
          title="No payments yet"
          description="Generate monthly fees to see paid vs pending here."
        />
      </ChartShell>
    );
  }
  const total = slices.reduce((a, s) => a + s.amount, 0);
  const collected = slices.reduce(
    (a, s) => a + (s.collected ?? (s.key === "paid" ? s.amount : 0)),
    0
  );
  const coll = total > 0 ? Math.round((collected / total) * 1000) / 10 : 0;
  if (slices.length === 0) {
    return (
      <ChartShell title="Payment status" subtitle="No fee ledger yet">
        <EmptyState
          title="No payments yet"
          description="Generate monthly fees to see paid vs pending here."
        />
      </ChartShell>
    );
  }
  const openCount = hasLedger
    ? unpaidCount(base.fees ?? [])
    : slices.slice(1, 4).reduce((a, s) => a + (s?.count ?? 0), 0);
  const openAmt = total - collected;
  const colors = [PALETTE.ink, PALETTE.blue, PALETTE.amber, PALETTE.red];
  return (
    <ChartShell
      title="Payment status"
      subtitle={`${coll}% collected · ${formatCurrency(total)} billed${hasLiveCounts || hasLedger ? " · live" : ""}`}
      onExport={() =>
        downloadCSV(
          "payment-status.csv",
          toCSV(
            ["status", "amount", "invoices"],
            slices.map((s) => [s.label, s.amount, s.count])
          )
        )
      }
      footer={
        <p>
          Only 4 lifecycle states — paid, partial, pending, overdue — so a donut stays readable.
        </p>
      }
    >
      <Donut
        centerTop={`${coll}%`}
        centerBottom="collected"
        slices={slices.map((s, i) => ({
          color: colors[i],
          label: s.label,
          value: Math.max(1, s.amount),
          display: `${formatCompact(s.amount)} · ${s.count}`,
        }))}
      />
      <Insight
        tone={coll >= 75 ? "good" : coll >= 55 ? "warn" : "bad"}
        title={coll >= 75 ? "Collection health is strong." : "Collection needs a push."}
        body={
          openAmt > 0
            ? `${formatCurrency(openAmt)} is still open across ${openCount} invoices. Start with overdue.`
            : "Nothing outstanding — every invoice is settled."
        }
      />
    </ChartShell>
  );
}
