"use client";
import { useMemo, useState } from "react";
import { ChartShell, AreaLines } from "../chart-core";
import { StackedBars } from "../chart-parts";
import { Insight } from "../chart-misc";
import { Legend, PALETTE, Segmented } from "../charts";
import { downloadCSV, toCSV, type AnalyticsBase, type RangeKey } from "@/lib/analytics";
import { capacityByBuilding, revenueVsExpenses } from "@/lib/analytics-ops";
import { formatCurrency } from "@/lib/utils";
export function RevExpSection({ base }: { base: AnalyticsBase }) {
  const [range, setRange] = useState<RangeKey>("6m");
  const data = useMemo(() => revenueVsExpenses(base, range), [base, range]);
  const neg = data.filter((d) => d.net < 0);
  return (
    <ChartShell title="Revenue vs expenses" subtitle={neg.length ? `${neg.length} periods ran at a loss` : "Profitable across the window"}
      filters={<Segmented label="Compare range" value={range} onChange={setRange}
        options={[{ value: "30d", label: "30D" }, { value: "3m", label: "3M" }, { value: "6m", label: "6M" }, { value: "1y", label: "1Y" }]} />}
      onExport={() => downloadCSV(`rev-exp-${range}.csv`, toCSV(["label", "revenue", "expenses", "net"], data.map((d) => [d.label, d.revenue, d.expenses, d.net])))}
      footer={<Legend items={[{ color: PALETTE.ink, label: "Revenue" }, { color: PALETTE.red, label: "Expenses" }, { color: PALETTE.limeDark, label: "Net" }]} />}>
      <AreaLines labels={data.map((d) => d.label)}
        series={[{ color: PALETTE.ink, values: data.map((d) => d.revenue) },
          { color: PALETTE.red, values: data.map((d) => d.expenses) },
          { color: PALETTE.limeDark, values: data.map((d) => Math.max(0, d.net)) }]}
        formatY={(v) => formatCurrency(v)} />
      <Insight tone={neg.length ? "bad" : "good"} title={neg.length ? `Loss in ${neg.slice(0, 3).map((d) => d.label).join(", ")}.` : "Margin is healthy."}
        body={neg.length ? "Spike lines up with maintenance season — cap discretionary supplies." : "Consider reinvesting in the lowest-occupancy floor."} />
    </ChartShell>
  );
}
export function CapacitySection() {
  const rows = useMemo(() => capacityByBuilding(), []);
  return (
    <ChartShell title="Bed / room capacity" subtitle="Occupied · reserved · available · maintenance"
      onExport={() => downloadCSV("capacity.csv", toCSV(["group", "occupied", "reserved", "available", "maint"], rows.map((r) => [r.label, r.occupied, r.reserved, r.available, r.maintenance])))}
      footer={<Legend items={[{ color: PALETTE.ink, label: "Occupied" }, { color: PALETTE.blue, label: "Reserved" }, { color: PALETTE.limeDark, label: "Available" }, { color: PALETTE.red, label: "Maintenance" }]} />}>
      <StackedBars labels={rows.map((r) => r.label)}
        stacks={[{ color: PALETTE.ink, label: "Occupied", values: rows.map((r) => r.occupied) },
          { color: PALETTE.blue, label: "Reserved", values: rows.map((r) => r.reserved) },
          { color: PALETTE.limeDark, label: "Available", values: rows.map((r) => r.available) },
          { color: PALETTE.red, label: "Maintenance", values: rows.map((r) => r.maintenance) }]} />
      <Insight tone="warn" title="Block C has the most beds offline." body="Clear maintenance rooms first — every week idle is lost rent." />
    </ChartShell>
  );
}
