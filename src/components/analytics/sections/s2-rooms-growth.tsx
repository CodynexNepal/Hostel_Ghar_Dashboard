"use client";
import { useMemo, useState } from "react";
import { ChartShell } from "../chart-core";
import { GroupBars } from "../chart-bars";
import { Legend, PALETTE, Segmented } from "../charts";
import { Insight } from "../chart-misc";
import { downloadCSV, toCSV } from "@/lib/analytics";
import { residentGrowth, roomOccupancy } from "@/lib/analytics-series";
import { AreaLines } from "../chart-core";
import type { RangeKey } from "@/lib/analytics";
export function RoomSection() {
  const [b, setB] = useState("all");
  const rows = useMemo(() => roomOccupancy(), []);
  const shown = b === "all" ? rows : rows.filter((r) => r.key === b);
  const full = shown.reduce((a, r) => a + r.full, 0);
  return (
    <ChartShell title="Room occupancy" subtitle="Fully · partially · available rooms by block"
      filters={<Segmented label="Building" value={b} onChange={setB}
        options={[{ value: "all", label: "All" }, ...rows.map((r) => ({ value: r.key, label: r.label }))]} />}
      onExport={() => downloadCSV("room-occupancy.csv", toCSV(["block", "full", "partial", "available"], shown.map((r) => [r.label, r.full, r.partial, r.available])))}
      footer={<Legend items={[{ color: PALETTE.ink, label: "Fully occupied" }, { color: PALETTE.amber, label: "Partially occupied" }, { color: PALETTE.limeDark, label: "Available" }]} />}>
      <GroupBars labels={shown.map((r) => r.label)}
        groups={[{ color: PALETTE.ink, label: "Full", values: shown.map((r) => r.full) },
          { color: PALETTE.amber, label: "Partial", values: shown.map((r) => r.partial) },
          { color: PALETTE.limeDark, label: "Available", values: shown.map((r) => r.available) }]} />
      <Insight tone="info" title={`${full} rooms are 100% full.`} body="Partially occupied rooms are the fastest fill — offer them first before opening empty rooms." />
    </ChartShell>
  );
}
export function GrowthSection() {
  const [mode, setMode] = useState<RangeKey>("1y");
  const data = useMemo(() => residentGrowth(mode), [mode]);
  const joined = data.reduce((a, d) => a + d.joined, 0);
  const left = data.reduce((a, d) => a + d.left, 0);
  return (
    <ChartShell title="Resident growth" subtitle={`${joined} joined · ${left} left · net +${joined - left}`}
      filters={<Segmented label="Growth view" value={mode} onChange={setMode}
        options={[{ value: "30d" as RangeKey, label: "Monthly" }, { value: "1y" as RangeKey, label: "Yearly" }]} />}
      onExport={() => downloadCSV(`growth-${mode}.csv`, toCSV(["label", "joined", "left", "net"], data.map((d) => [d.label, d.joined, d.left, d.net])))}
      footer={<Legend items={[{ color: PALETTE.limeDark, label: "New residents" }, { color: PALETTE.red, label: "Left" }, { color: PALETTE.ink, label: "Net" }]} />}>
      <AreaLines labels={data.map((d) => d.label)}
        series={[{ color: PALETTE.limeDark, values: data.map((d) => d.joined) },
          { color: PALETTE.red, values: data.map((d) => d.left) },
          { color: PALETTE.ink, values: data.map((d) => Math.max(0, d.net + Math.max(...data.map((x) => x.joined)) * 0.15)) }]} />
      <Insight tone={joined - left >= 0 ? "good" : "bad"} title={joined - left >= 0 ? "Net growth is positive." : "Churn needs attention."}
        body={`Net ${joined - left >= 0 ? "+" : ""}${joined - left} residents in this period. ${left > joined * 0.6 ? "Exits are high — survey vacating residents." : "Retention looks healthy."}`} />
    </ChartShell>
  );
}
