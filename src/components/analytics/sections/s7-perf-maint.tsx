"use client";
import { useMemo, useState } from "react";
import { ChartShell, AreaLines } from "../chart-core";
import { GroupBars } from "../chart-bars";
import { Insight } from "../chart-misc";
import { Legend, PALETTE, Segmented } from "../charts";
import { downloadCSV, formatCompact, toCSV, type AnalyticsBase, type RangeKey } from "@/lib/analytics";
import { hostelPerformance, maintenanceTrend } from "@/lib/analytics-ops";
import { formatCurrency } from "@/lib/utils";
export function PerformanceSection({ base }: { base: AnalyticsBase }) {
  const rows = useMemo(() => hostelPerformance(base), [base]);
  const [sel, setSel] = useState<string[]>(rows.map((r) => r.id));
  const shown = rows.filter((r) => sel.includes(r.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const lag = [...shown].sort((a, b) => a.occupancyRate - b.occupancyRate)[0];
  return (
    <ChartShell title="Hostel performance" subtitle="Compare occupancy, revenue and dues"
      filters={<div className="flex flex-wrap gap-1.5">{rows.map((r) => (
        <button key={r.id} onClick={() => toggle(r.id)} aria-pressed={sel.includes(r.id)}
          className={sel.includes(r.id) ? "h-7 rounded-full bg-brand-ink px-2.5 text-xs font-semibold text-brand" : "h-7 rounded-full border px-2.5 text-xs text-neutral-500"}>
          {r.name.split("·")[0]}</button>))}</div>}
      onExport={() => downloadCSV("performance.csv", toCSV(["hostel", "occ", "rev", "dues", "res", "per_bed"],
        shown.map((r) => [r.name, r.occupancyRate, r.revenue, r.outstanding, r.residents, r.revPerBed])))}
      footer={<Legend items={[{ color: PALETTE.ink, label: "Occupancy %" }, { color: PALETTE.amber, label: "Dues (k)" }]} />}>
      {shown.length === 0 ? (<p className="py-8 text-center text-sm text-neutral-500">Select at least one hostel.</p>) : (<>
        <GroupBars labels={shown.map((r) => r.name.split("·")[0])}
          groups={[{ color: PALETTE.ink, label: "Occ", values: shown.map((r) => r.occupancyRate) },
            { color: PALETTE.amber, label: "Dues", values: shown.map((r) => Math.round(r.outstanding / 1000)) }]} />
        <ul className="mt-3 space-y-2">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-4 rounded-lg bg-surface-muted/60 px-3 py-2 text-[13px]">
              <strong className="min-w-0 flex-1 truncate">{r.name}</strong>
              <span>{r.occupancyRate}%</span><span className="font-semibold">{formatCurrency(r.revenue)}</span>
              <span className="text-red-600">{formatCompact(r.outstanding)} dues</span>
              <span className="text-neutral-500">{r.residents} res · {formatCurrency(r.revPerBed)}/bed</span>
            </li>))}
        </ul>
        {lag && <Insight tone="warn" title={`${lag.name.split("·")[0].trim()} trails at ${lag.occupancyRate}%.`} body={`Carries ${formatCurrency(lag.outstanding)} in dues — audit vacancies and oldest invoices.`} />}
      </>)}
    </ChartShell>
  );
}
export function MaintenanceSection() {
  const [range, setRange] = useState<RangeKey>("30d");
  const data = useMemo(() => maintenanceTrend(range), [range]);
  const open = data.reduce((a, d) => a + d.opened, 0);
  const done = data.reduce((a, d) => a + d.resolved, 0);
  return (
    <ChartShell title="Maintenance analytics" subtitle={`${open} opened · ${done} resolved · avg 1.8d fix`}
      filters={<Segmented label="Maint range" value={range} onChange={setRange}
        options={[{ value: "7d", label: "7D" }, { value: "30d", label: "30D" }, { value: "3m", label: "3M" }, { value: "6m", label: "6M" }]} />}
      onExport={() => downloadCSV(`maint-${range}.csv`, toCSV(["label", "opened", "resolved", "pending"], data.map((d) => [d.label, d.opened, d.resolved, d.pending])))}
      footer={<Legend items={[{ color: PALETTE.amber, label: "Opened" }, { color: PALETTE.limeDark, label: "Resolved" }, { color: PALETTE.red, label: "Backlog" }]} />}>
      <AreaLines labels={data.map((d) => d.label)}
        series={[{ color: PALETTE.amber, values: data.map((d) => d.opened) },
          { color: PALETTE.limeDark, values: data.map((d) => d.resolved) },
          { color: PALETTE.red, values: data.map((d) => d.pending), dashed: true }]} />
      <Insight tone={data[data.length - 1].pending > 6 ? "bad" : "good"}
        title={data[data.length - 1].pending > 6 ? "Backlog is building." : "Resolution keeps pace."}
        body={`Backlog now ${data[data.length - 1].pending} tickets. Batch plumbing + electrical per floor.`} />
    </ChartShell>
  );
}
