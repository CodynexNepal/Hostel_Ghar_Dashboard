"use client";
import { useMemo } from "react";
import { ChartShell } from "../chart-core";
import { GroupBars } from "../chart-bars";
import { Legend, PALETTE } from "../charts";
import { Insight } from "../chart-misc";
import { downloadCSV, toCSV, type AnalyticsBase } from "@/lib/analytics";
import { residentJoinsByMonth } from "@/lib/analytics-live";
import { AreaLines } from "../chart-core";
import { EmptyState } from "@/components/ui/EmptyState";
/**
 * Owner-scoped room status — derived ONLY from GET /rooms (owner hostels),
 * grouped by floor label. No Block A/B/C demo rows.
 */
export function RoomSection({ base }: { base: AnalyticsBase }) {
  const rooms = useMemo(() => base.rooms ?? [], [base.rooms]);
  const groups = useMemo(() => {
    const byFloor = new Map<string, { full: number; partial: number; available: number }>();
    for (const r of rooms) {
      const label = r.floor > 0 ? `Floor ${r.floor}` : "No floor";
      const cur = byFloor.get(label) ?? { full: 0, partial: 0, available: 0 };
      const cap = Math.max(0, r.capacity || 0);
      const occ = Math.min(cap, Math.max(0, r.occupied || 0));
      if (occ >= cap && cap > 0) cur.full += 1;
      else if (occ > 0) cur.partial += 1;
      else cur.available += 1;
      byFloor.set(label, cur);
    }
    return [...byFloor.entries()]
      .map(([label, v]) => ({ key: label, label, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rooms]);
  if (rooms.length === 0) {
    return (
      <ChartShell title="Room occupancy" subtitle="No rooms yet">
        <EmptyState
          title="No rooms yet"
          description="Add rooms to see full vs partial vs available here."
        />
      </ChartShell>
    );
  }
  const full = groups.reduce((a, r) => a + r.full, 0);
  const shown = groups;
  return (
    <ChartShell
      title="Room occupancy"
      subtitle="Full · partial · available rooms by floor"
      onExport={() =>
        downloadCSV(
          "room-occupancy.csv",
          toCSV(
            ["floor", "full", "partial", "available"],
            shown.map((r) => [r.label, r.full, r.partial, r.available])
          )
        )
      }
      footer={
        <Legend
          items={[
            { color: PALETTE.ink, label: "Fully occupied" },
            { color: PALETTE.amber, label: "Partially occupied" },
            { color: PALETTE.limeDark, label: "Available" },
          ]}
        />
      }
    >
      <GroupBars
        labels={shown.map((r) => r.label)}
        groups={[
          { color: PALETTE.ink, label: "Full", values: shown.map((r) => r.full) },
          { color: PALETTE.amber, label: "Partial", values: shown.map((r) => r.partial) },
          { color: PALETTE.limeDark, label: "Available", values: shown.map((r) => r.available) },
        ]}
      />
      <Insight
        tone="info"
        title={`${full} rooms are 100% full.`}
        body="Partially occupied rooms are the fastest fill — offer them first before opening empty rooms."
      />
    </ChartShell>
  );
}
/**
 * Owner-scoped resident growth — real joins/month from the live residents
 * list (honest zeros). No invented "joined/left/net" curves.
 */
export function GrowthSection({ base }: { base: AnalyticsBase }) {
  const residents = useMemo(() => base.residents ?? [], [base.residents]);
  const data = useMemo(() => residentJoinsByMonth(residents, 12), [residents]);
  const joined = data.reduce((a, d) => a + d.joined, 0);
  if (residents.length === 0) {
    return (
      <ChartShell title="Resident growth" subtitle="No residents yet">
        <EmptyState
          title="No residents yet"
          description="Add residents to track monthly joins here."
        />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title="Resident joins"
      subtitle={`${joined} joined in the last 12 months · live from residents`}
      onExport={() =>
        downloadCSV(
          "resident-joins.csv",
          toCSV(
            ["month", "joined"],
            data.map((d) => [d.label, d.joined])
          )
        )
      }
      footer={<Legend items={[{ color: PALETTE.limeDark, label: "Joined" }]} />}
    >
      <AreaLines
        labels={data.map((d) => d.label)}
        series={[{ color: PALETTE.limeDark, values: data.map((d) => d.joined) }]}
      />
      <Insight
        tone={joined > 0 ? "good" : "info"}
        title={joined > 0 ? `${joined} joins in the window.` : "No joins in the window."}
        body="Derived from your resident move-in dates."
      />
    </ChartShell>
  );
}
