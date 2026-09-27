"use client";
import { useMemo, useState } from "react";
import { ChartShell, AreaLines } from "../chart-core";
import { Donut, Insight } from "../chart-misc";
import { Legend, PALETTE, Segmented } from "../charts";
import { downloadCSV, formatCompact, toCSV, type AnalyticsBase, type TrendMode } from "@/lib/analytics";
import { paymentStatus, revenueSeries } from "@/lib/analytics-series";
import { formatCurrency } from "@/lib/utils";
export function RevenueSection({ base }: { base: AnalyticsBase }) {
  const [mode, setMode] = useState<TrendMode>("monthly");
  const data = useMemo(() => revenueSeries(base, mode), [base, mode]);
  const tot = data.reduce((a, d) => a + d.total, 0);
  const prev = data.reduce((a, d) => a + d.prevTotal, 0);
  const pct = Math.round(((tot - prev) / Math.max(1, prev)) * 100);
  return (
    <ChartShell title="Revenue analytics" subtitle={`${formatCurrency(tot)} this period · ${pct >= 0 ? "+" : ""}${pct}% vs previous`}
      filters={<Segmented label="Revenue granularity" value={mode} onChange={setMode}
        options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />}
      onExport={() => downloadCSV(`revenue-${mode}.csv`, toCSV(["label", "rent", "other", "pending", "total", "prev_total"],
        data.map((d) => [d.label, d.rent, d.other, d.pending, d.total, d.prevTotal])))}
      footer={<Legend items={[{ color: PALETTE.ink, label: "Total revenue" }, { color: PALETTE.slate, label: "Previous period" }, { color: PALETTE.amber, label: "Pending rent" }]} />}>
      <AreaLines labels={data.map((d) => d.label)}
        series={[{ color: PALETTE.ink, values: data.map((d) => d.total) },
          { color: PALETTE.slate, values: data.map((d) => d.prevTotal), dashed: true },
          { color: PALETTE.amber, values: data.map((d) => d.pending) }]}
        formatY={(v) => formatCurrency(v)} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[["Rent", data.reduce((a, d) => a + d.rent, 0)], ["Other income", data.reduce((a, d) => a + d.other, 0)], ["Pending", data.reduce((a, d) => a + d.pending, 0)]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-surface-muted px-2 py-2">
            <p className="text-[11px] text-neutral-500">{l}</p>
            <p className="text-sm font-bold tabular-nums">{formatCompact(v as number)}</p>
          </div>
        ))}
      </div>
      <Insight tone={pct >= 0 ? "good" : "bad"} title={pct >= 0 ? `Revenue up ${pct}% vs previous period.` : `Revenue down ${pct}% vs previous period.`}
        body={pct >= 0 ? "Collections are outpacing last period — keep the reminder cadence." : "Collections dipped — chase the oldest pending invoices first."} />
    </ChartShell>
  );
}
export function PaymentSection({ base }: { base: AnalyticsBase }) {
  const slices = useMemo(() => paymentStatus(base), [base]);
  const total = slices.reduce((a, s) => a + s.amount, 0);
  const colors = [PALETTE.ink, PALETTE.blue, PALETTE.amber, PALETTE.red];
  const coll = Math.round((slices[0].amount / Math.max(1, total)) * 100);
  return (
    <ChartShell title="Payment status" subtitle={`${coll}% collected · ${formatCurrency(total)} billed`}
      onExport={() => downloadCSV("payment-status.csv", toCSV(["status", "amount", "residents"], slices.map((s) => [s.label, s.amount, s.count])))}
      footer={<p>Only 4 lifecycle states — paid, partial, pending, overdue — so a donut stays readable.</p>}>
      <Donut centerTop={`${coll}%`} centerBottom="collected"
        slices={slices.map((s, i) => ({ color: colors[i], label: s.label, value: Math.max(1, s.amount), display: `${formatCompact(s.amount)} · ${s.count}` }))} />
      <Insight tone={coll >= 75 ? "good" : coll >= 55 ? "warn" : "bad"}
        title={coll >= 75 ? "Collection health is strong." : "Collection needs a push."}
        body={`${formatCurrency(slices[3].amount + slices[2].amount)} is still open across ${slices[2].count + slices[3].count} residents. Start with overdue.`} />
    </ChartShell>
  );
}
