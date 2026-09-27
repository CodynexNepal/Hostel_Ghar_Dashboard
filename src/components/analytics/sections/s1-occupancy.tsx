"use client";
import { useMemo, useState } from "react";
import { ChartShell } from "../chart-core";
import { Legend, PALETTE, Segmented } from "../charts";
import { AreaLines } from "../chart-core";
import { Insight } from "../chart-misc";
import { RANGE_OPTIONS, downloadCSV, toCSV, type AnalyticsBase, type RangeKey } from "@/lib/analytics";
import { occupancyTrend } from "@/lib/analytics-series";
export function OccupancySection({ base }: { base: AnalyticsBase }) {
  const [range, setRange] = useState<RangeKey>("30d");
  const data = useMemo(() => occupancyTrend(base, range), [base, range]);
  const last = data[data.length - 1];
  const first = data[0];
  const delta = Math.round((last.occupancyRate - first.occupancyRate) * 10) / 10;
  return (
    <ChartShell title="Occupancy analytics" subtitle={`Rate · occupied · available — last ${last.label}`}
      filters={<Segmented label="Occupancy range" value={range} onChange={setRange}
        options={RANGE_OPTIONS.map((r) => ({ value: r.key, label: r.label }))} />}
      onExport={() => downloadCSV(`occupancy-${range}.csv`, toCSV(["label", "rate_pct", "occupied", "available", "capacity"],
        data.map((d) => [d.label, d.occupancyRate, d.occupied, d.available, d.capacity])))}
      footer={<Legend items={[{ color: PALETTE.ink, label: "Occupied beds" }, { color: PALETTE.limeDark, label: "Available beds" }, { color: PALETTE.slate, label: "Occupancy % (scaled)" }]} />}>
      <div className="mb-3 flex flex-wrap gap-4 text-[13px]">
        <p><span className="text-neutral-500">Now </span><strong className="text-lg text-neutral-900">{last.occupancyRate}%</strong></p>
        <p><span className="text-neutral-500">Occupied </span><strong>{last.occupied}</strong></p>
        <p><span className="text-neutral-500">Available </span><strong>{last.available}</strong></p>
        <p className={delta >= 0 ? "text-[#65a30d] font-semibold" : "text-red-600 font-semibold"}>{delta >= 0 ? `▲ +${delta} pts` : `▼ ${delta} pts`} in period</p>
      </div>
      <AreaLines labels={data.map((d) => d.label)}
        series={[{ color: PALETTE.ink, values: data.map((d) => d.occupied) },
          { color: PALETTE.limeDark, values: data.map((d) => d.available) },
          { color: PALETTE.slate, values: data.map((d) => Math.round((d.occupancyRate / 100) * d.capacity)), dashed: true }]}
        formatY={(v) => `${v} beds`} />
      <Insight tone={delta >= 0 ? "good" : "warn"} title={delta >= 0 ? "Demand is climbing." : "Watch vacancies."}
        body={delta >= 0 ? `Occupancy rose ${delta} pts to ${last.occupancyRate}% — keep ${last.available} open beds listed.` : `Occupancy slipped ${Math.abs(delta)} pts — ${last.available} beds are open. Push referrals for the soft floor.`} />
    </ChartShell>
  );
}
