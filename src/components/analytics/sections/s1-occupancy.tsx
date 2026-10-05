"use client";
import { useMemo } from "react";
import { ChartShell } from "../chart-core";
import { Legend, PALETTE } from "../charts";
import { GroupBars } from "../chart-bars";
import { Insight } from "../chart-misc";
import { downloadCSV, toCSV, type AnalyticsBase } from "@/lib/analytics";
import { EmptyState } from "@/components/ui/EmptyState";
/**
 * Owner-scoped occupancy — current snapshot ONLY from GET /rooms
 * (your hostels). No invented 30-day trend: a fake drift curve would
 * contradict the live KPI (e.g. 5 residents vs 132 occupied beds).
 */
export function OccupancySection({ base }: { base: AnalyticsBase }) {
  const rooms = useMemo(() => base.rooms ?? [], [base.rooms]);
  const { totalBeds, occupiedBeds } = useMemo(() => {
    const cap = rooms.reduce((s, r) => s + Math.max(0, r.capacity || 0), 0);
    const occ = rooms.reduce(
      (s, r) => s + Math.min(Math.max(0, r.capacity || 0), Math.max(0, r.occupied || 0)),
      0
    );
    return { totalBeds: cap, occupiedBeds: occ };
  }, [rooms]);
  const available = Math.max(0, totalBeds - occupiedBeds);
  const rate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;
  const byFloor = useMemo(() => {
    const m = new Map<string, { occupied: number; available: number }>();
    for (const r of rooms) {
      const label = r.floor > 0 ? `Floor ${r.floor}` : "No floor";
      const cur = m.get(label) ?? { occupied: 0, available: 0 };
      const cap = Math.max(0, r.capacity || 0);
      const occ = Math.min(cap, Math.max(0, r.occupied || 0));
      cur.occupied += occ;
      cur.available += Math.max(0, cap - occ);
      m.set(label, cur);
    }
    return [...m.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rooms]);
  if (rooms.length === 0) {
    return (
      <ChartShell title="Occupancy analytics" subtitle="No rooms yet">
        <EmptyState
          title="No occupancy yet"
          description="Add rooms to see occupied vs available beds here."
        />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title="Occupancy analytics"
      subtitle={`${rate}% occupied · ${occupiedBeds} of ${totalBeds} beds · live from rooms`}
      onExport={() =>
        downloadCSV(
          "occupancy.csv",
          toCSV(
            ["floor", "occupied", "available"],
            byFloor.map((r) => [r.label, r.occupied, r.available])
          )
        )
      }
      footer={
        <Legend
          items={[
            { color: PALETTE.ink, label: "Occupied beds" },
            { color: PALETTE.limeDark, label: "Available beds" },
          ]}
        />
      }
    >
      <div className="mb-3 flex flex-wrap gap-4 text-[13px]">
        <p>
          <span className="text-neutral-500">Now </span>
          <strong className="text-lg text-neutral-900">{rate}%</strong>
        </p>
        <p>
          <span className="text-neutral-500">Occupied </span>
          <strong>{occupiedBeds}</strong>
        </p>
        <p>
          <span className="text-neutral-500">Available </span>
          <strong>{available}</strong>
        </p>
      </div>
      <GroupBars
        labels={byFloor.map((r) => r.label)}
        groups={[
          { color: PALETTE.ink, label: "Occupied", values: byFloor.map((r) => r.occupied) },
          { color: PALETTE.limeDark, label: "Available", values: byFloor.map((r) => r.available) },
        ]}
      />
      <Insight
        tone={rate >= 70 ? "good" : "warn"}
        title={rate >= 70 ? "Occupancy is healthy." : "Vacancies to fill."}
        body={`${available} beds are open across ${byFloor.length} floor${byFloor.length === 1 ? "" : "s"} — push referrals for the softest floor.`}
      />
    </ChartShell>
  );
}
