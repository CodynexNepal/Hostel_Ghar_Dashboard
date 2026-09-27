"use client";
import { useMemo, useState } from "react";
import { ChartShell } from "../chart-core";
import { HBarList } from "../chart-parts";
import { Donut } from "../chart-misc";
import { PALETTE, Segmented } from "../charts";
import { downloadCSV, toCSV } from "@/lib/analytics";
import { demographics } from "@/lib/analytics-ops";
export function DemographicsSection() {
  const [tab, setTab] = useState<"gender" | "age" | "occupation" | "roomType">("gender");
  const demo = useMemo(() => demographics(), []);
  const rows = demo[tab];
  const total = rows.reduce((a, r) => a + r.value, 0);
  const colors = [PALETTE.ink, PALETTE.limeDark, PALETTE.blue, PALETTE.amber];
  return (
    <ChartShell title="Resident demographics" subtitle="Gender · age · category · room preference"
      filters={<Segmented label="Demographic view" value={tab} onChange={setTab}
        options={[{ value: "gender", label: "Gender" }, { value: "age", label: "Age" }, { value: "occupation", label: "Category" }, { value: "roomType", label: "Room" }]} />}
      onExport={() => downloadCSV(`demo-${tab}.csv`, toCSV(["segment", "share"], rows.map((r) => [r.label, r.value])))}>
      {tab === "gender" ? (
        <Donut centerTop={`${Math.round((rows[1].value / total) * 100)}%`} centerBottom="female"
          slices={rows.map((r, i) => ({ color: colors[i], label: r.label, value: r.value, display: `${r.value}%` }))} />
      ) : (
        <HBarList rows={rows.map((r) => ({ label: r.label, value: r.value, sub: `${Math.round((r.value / total) * 100)}%` }))}
          formatV={(v) => `${v}%`} accent={tab === "age" ? PALETTE.blue : tab === "occupation" ? PALETTE.violet : PALETTE.teal} />
      )}
    </ChartShell>
  );
}
