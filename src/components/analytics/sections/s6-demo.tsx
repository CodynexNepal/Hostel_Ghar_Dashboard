"use client";
import { useMemo } from "react";
import { ChartShell } from "../chart-core";
import { HBarList } from "../chart-parts";
import { Donut } from "../chart-misc";
import { PALETTE } from "../charts";
import { downloadCSV, toCSV, type AnalyticsBase } from "@/lib/analytics";
import { EmptyState } from "@/components/ui/EmptyState";
/**
 * Owner-scoped demographics — live residents only (gender split from
 * resident names is unavailable, so we report payment-status mix and
 * floor mix from real rows). No invented 47%/45% gender splits.
 */
export function DemographicsSection({ base }: { base: AnalyticsBase }) {
  const residents = useMemo(() => base.residents ?? [], [base.residents]);
  const payMix = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of residents) m.set(r.paymentStatus, (m.get(r.paymentStatus) ?? 0) + 1);
    return [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [residents]);
  const floorMix = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of residents) {
      const label = r.floor > 0 ? `Floor ${r.floor}` : "No floor";
      m.set(label, (m.get(label) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [residents]);
  const colors = [PALETTE.ink, PALETTE.limeDark, PALETTE.blue, PALETTE.amber];
  if (residents.length === 0) {
    return (
      <ChartShell title="Resident mix" subtitle="No residents yet">
        <EmptyState
          title="No residents yet"
          description="Add residents to see payment and floor mix here."
        />
      </ChartShell>
    );
  }
  const total = Math.max(1, residents.length);
  return (
    <ChartShell
      title="Resident mix"
      subtitle={`${residents.length} residents · live payment + floor mix`}
      onExport={() =>
        downloadCSV(
          "resident-mix.csv",
          toCSV(
            ["segment", "count"],
            [
              ...payMix.map((r) => [`pay:${r.label}`, r.value]),
              ...floorMix.map((r) => [`floor:${r.label}`, r.value]),
            ]
          )
        )
      }
    >
      <Donut
        centerTop={`${residents.length}`}
        centerBottom="residents"
        slices={payMix.map((r, i) => ({
          color: colors[i % colors.length],
          label: r.label,
          value: r.value,
          display: `${r.value}`,
        }))}
      />
      <div className="mt-3">
        <HBarList
          rows={floorMix.map((r) => ({
            label: r.label,
            value: r.value,
            sub: `${Math.round((r.value / total) * 100)}%`,
          }))}
          formatV={(v) => `${v}`}
          accent={PALETTE.teal}
        />
      </div>
    </ChartShell>
  );
}
