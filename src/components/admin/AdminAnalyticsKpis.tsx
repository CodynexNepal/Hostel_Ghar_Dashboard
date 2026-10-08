"use client";

import { Building2, Users, Wallet, Crown, BedDouble, Percent } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency } from "@/lib/utils";
import type { AdminSummaryWithCounts } from "@/lib/hostelGhar";

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Platform KPI strip for the admin analytics page.
 * Every value is live from GET /analytics/admin/summary — missing keys
 * render "—", never invented numbers.
 */
export function AdminAnalyticsKpis({ summary }: { summary: AdminSummaryWithCounts | null }) {
  const hostels = num(summary?.totalHostels);
  const residents = num(summary?.totalResidents ?? summary?.activeResidents);
  const occupied = num(summary?.occupiedBeds);
  const totalBeds = num(summary?.totalBeds);
  const occ =
    num(summary?.occupancyRate) ??
    (occupied !== null && totalBeds !== null && totalBeds > 0
      ? Math.round((occupied / totalBeds) * 1000) / 10
      : null);
  const mrr = num(summary?.mrr ?? summary?.monthlyRevenue) ?? 0;
  const collected = num(summary?.paidAmount ?? summary?.totalRevenue) ?? 0;
  const outstanding = num(summary?.outstandingAmount ?? summary?.pendingAmount) ?? 0;
  const collRate = num(summary?.collectionRate);
  const activePlans =
    typeof summary?.activePlans === "number"
      ? summary.activePlans
      : Number(summary?.activePlans) || num(summary?.stats?.mrrPaidPlans);

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      aria-label="Platform KPIs"
    >
      <StatCard
        icon={Building2}
        title="Total Hostels"
        value={hostels !== null ? String(hostels) : "—"}
        delta={summary ? "live" : "no data"}
        deltaUp={summary !== null}
        hint="on the platform"
      />
      <StatCard
        icon={Users}
        title="Total Residents"
        value={residents !== null ? residents.toLocaleString("en-NP") : "—"}
        delta={summary ? "live" : "no data"}
        deltaUp={summary !== null}
        hint="active now"
      />
      <StatCard
        icon={BedDouble}
        title="Occupied Beds"
        value={
          occupied !== null && totalBeds !== null
            ? `${occupied} / ${totalBeds}`
            : occupied !== null
              ? String(occupied)
              : "—"
        }
        delta={occ !== null ? `${occ}%` : "—"}
        deltaUp={(occ ?? 0) >= 70}
        hint="platform occupancy"
      />
      <StatCard
        icon={Wallet}
        title="MRR"
        value={formatCurrency(mrr)}
        delta={
          activePlans != null ? `${activePlans} paid plans` : (summary?.mrrBasis ?? "recurring")
        }
        deltaUp
        hint="subscription revenue"
      />
      <StatCard
        icon={Crown}
        title="Collected"
        value={formatCurrency(collected)}
        delta={collRate !== null ? `${collRate}% rate` : "all time"}
        deltaUp={(collRate ?? 100) >= 75}
        hint="rent collected"
      />
      <StatCard
        icon={Percent}
        title="Outstanding"
        value={formatCurrency(outstanding)}
        delta={outstanding > 0 ? "follow-up" : "clear"}
        deltaUp={outstanding === 0}
        hint="still open"
      />
    </div>
  );
}
