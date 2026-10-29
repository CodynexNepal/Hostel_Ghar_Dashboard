"use client";
import { useMemo } from "react";
import { ChartShell } from "../chart-core";
import { GroupBars } from "../chart-bars";
import { Insight } from "../chart-misc";
import { Legend, PALETTE } from "../charts";
import { downloadCSV, formatCompact, toCSV, type AnalyticsBase } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
/**
 * Owner-scoped hostel table — the owner's OWN hostels from the dashboard
 * aggregate (name/type/residents). Never Sunrise/Green Valley demo rows.
 */
export function PerformanceSection({ base }: { base: AnalyticsBase }) {
  const rows = useMemo(() => base.hostels ?? [], [base.hostels]);
  const totalRes = rows.reduce((s, h) => s + (Number(h.totalActiveResidents) || 0), 0);
  if (rows.length === 0) {
    return (
      <ChartShell title="My hostels" subtitle="No hostel rows yet">
        <EmptyState
          title="No hostels yet"
          description="Your hostels will appear here once configured."
        />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title="My hostels"
      subtitle={`${rows.length} hostel${rows.length === 1 ? "" : "s"} · ${totalRes} active residents`}
      onExport={() =>
        downloadCSV(
          "my-hostels.csv",
          toCSV(
            ["hostel", "type", "active_residents"],
            rows.map((r) => [
              r.hostelName ?? r.hostelId,
              r.hostelType ?? "",
              Number(r.totalActiveResidents) || 0,
            ])
          )
        )
      }
      footer={<Legend items={[{ color: PALETTE.ink, label: "Active residents" }]} />}
    >
      <GroupBars
        labels={rows.map((r) => (r.hostelName ?? "Hostel").slice(0, 14))}
        groups={[
          {
            color: PALETTE.ink,
            label: "Residents",
            values: rows.map((r) => Number(r.totalActiveResidents) || 0),
          },
        ]}
      />
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li
            key={r.hostelId}
            className="flex flex-wrap gap-x-4 rounded-lg bg-surface-muted/60 px-3 py-2 text-[13px]"
          >
            <strong className="min-w-0 flex-1 truncate">{r.hostelName ?? "Hostel"}</strong>
            {r.hostelType && <span className="text-neutral-500">{r.hostelType}</span>}
            <span>{Number(r.totalActiveResidents) || 0} residents</span>
            {r.residentsOnLeaveToday !== undefined && (
              <span className="text-neutral-500">
                {Number(r.residentsOnLeaveToday) || 0} on leave
              </span>
            )}
          </li>
        ))}
      </ul>
    </ChartShell>
  );
}
export function MaintenanceSection() {
  return (
    <ChartShell title="Maintenance" subtitle="Not available">
      <EmptyState
        title="No maintenance feed"
        description="The backend has no maintenance endpoint yet — this panel stays hidden until one ships."
      />
    </ChartShell>
  );
}
export function MaintenanceHidden() {
  return null;
}
