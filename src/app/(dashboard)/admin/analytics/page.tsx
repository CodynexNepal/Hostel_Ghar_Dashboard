"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { AdminAnalyticsKpis } from "@/components/admin/AdminAnalyticsKpis";
import {
  PlatformOccupancySection,
  PlatformPaymentSection,
  PlatformPlanMixSection,
  PlatformRevenueSection,
  TopHostelsSection,
  type RangeKey,
} from "@/components/admin/AdminAnalyticsSections";
import { downloadCSV, toCSV } from "@/lib/analytics";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "30D" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
];
export default function AdminAnalyticsPage() {
  const {
    summary,
    hostels,
    error,
    summaryError,
    isLoading,
    isRefetching,
    filters,
    setFilters,
    refetch,
    retry,
  } = useAdminAnalytics();
  const hostelOptions = useMemo(
    () => [...hostels].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50),
    [hostels]
  );
  const activeHostel = hostels.find((h) => h.id === filters.hostelId) ?? null;
  const visibleHostels =
    filters.hostelId === "all" ? hostels : hostels.filter((h) => h.id === filters.hostelId);
  const occ = useMemo(() => {
    if (summary?.occupancyRate !== undefined && summary.occupancyRate !== null)
      return summary.occupancyRate;
    const occB = summary?.occupiedBeds ?? 0;
    const totB = summary?.totalBeds ?? 0;
    return totB > 0 ? Math.round((occB / totB) * 1000) / 10 : 0;
  }, [summary]);

  function exportAll() {
    const trend = Array.isArray(summary?.revenueTrend) ? summary!.revenueTrend! : [];
    downloadCSV(
      "platform-analytics.csv",
      toCSV(
        ["section", "label", "value"],
        [
          ["kpi", "hostels", summary?.totalHostels ?? ""],
          ["kpi", "residents", summary?.totalResidents ?? ""],
          ["kpi", "mrr", summary?.mrr ?? ""],
          ["kpi", "collected", summary?.paidAmount ?? summary?.totalRevenue ?? ""],
          ["kpi", "outstanding", summary?.outstandingAmount ?? summary?.pendingAmount ?? ""],
          ...trend.map(
            (t) =>
              ["revenue", String(t.label ?? ""), Number(t.collected ?? 0)] as [
                string,
                string,
                string | number,
              ]
          ),
          ...visibleHostels.map(
            (h) =>
              ["hostel", h.name, Math.max(0, h.occupiedBeds || 0)] as [
                string,
                string,
                string | number,
              ]
          ),
        ]
      )
    );
  }

  return (
    <DashboardShell
      title="Platform Analytics"
      subtitle="Revenue, occupancy, collection and growth — live across every hostel."
    >
      <Protected roles={["SUPER_ADMIN"]} redirectTo="/dashboard">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BackLink href="/admin" label="Platform overview" />
            <div className="flex flex-wrap items-center gap-2">
              {summary ? (
                <Badge tone="green">Live</Badge>
              ) : (
                <Badge tone="amber">No summary yet</Badge>
              )}

              {summary?.generatedAt && (
                <span className="text-xs text-neutral-400">
                  Updated {formatDateTime(summary.generatedAt)}
                  {summary.isCached ? ` · cached ${summary.cacheLevel ?? ""}`.trim() : ""}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={exportAll}>
                Export CSV
              </Button>
            </div>
          </div>
          {summaryError && (
            <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              Summary endpoint unreachable: {summaryError} — KPIs show “—” and charts degrade to
              empty states.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hostel filter">
              <button
                onClick={() => setFilters({ hostelId: "all" })}
                aria-pressed={filters.hostelId === "all"}
                className={
                  filters.hostelId === "all"
                    ? "h-8 rounded-full bg-brand-ink px-3 text-xs font-bold text-brand"
                    : "h-8 rounded-full border bg-white px-3 text-xs text-neutral-600"
                }
              >
                All hostels ({hostels.length})
              </button>
              {(activeHostel ? [activeHostel] : hostelOptions.slice(0, 4)).map((h) => (
                <button
                  key={h.id}
                  onClick={() => setFilters({ hostelId: h.id })}
                  aria-pressed={filters.hostelId === h.id}
                  className={
                    filters.hostelId === h.id
                      ? "h-8 rounded-full bg-brand-ink px-3 text-xs font-bold text-brand"
                      : "h-8 rounded-full border bg-white px-3 text-xs text-neutral-600"
                  }
                >
                  {h.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={filters.hostelId}
                onChange={(e) => setFilters({ hostelId: e.target.value })}
                className="h-8 rounded-md border border-surface-border bg-white px-2 text-xs"
                aria-label="All hostels"
              >
                <option value="all">All hostels</option>
                {hostelOptions.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <div
                className="inline-flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5"
                role="group"
                aria-label="Range"
              >
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setFilters({ range: r.key })}
                    aria-pressed={filters.range === r.key}
                    className={
                      filters.range === r.key
                        ? "h-7 rounded-md bg-brand-ink px-2.5 text-xs font-semibold text-brand"
                        : "h-7 rounded-md px-2.5 text-xs font-semibold text-neutral-500"
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
              aria-label="Loading analytics"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : error && !summary ? (
            <ErrorState title="Analytics unavailable" description={error.message} onRetry={retry} />
          ) : !summary && hostels.length === 0 ? (
            <EmptyState
              title="No analytics yet"
              description="The platform hasn't reported summary data. Create hostels and generate fees to unlock insights."
              action={
                <Link href="/admin/hostels">
                  <Button>Manage hostels</Button>
                </Link>
              }
            />
          ) : (
            <>
              <div
                className="grid gap-2 rounded-card bg-[#010101] p-4 text-white sm:grid-cols-5"
                role="status"
                aria-label="Answers"
              >
                {[
                  ["How big?", `${summary?.totalHostels ?? "—"} hostels`],
                  ["How full?", `${occ}% occupied`],
                  ["Collected?", formatCurrency(summary?.paidAmount ?? summary?.totalRevenue ?? 0)],
                  [
                    "Outstanding?",
                    formatCurrency(summary?.outstandingAmount ?? summary?.pendingAmount ?? 0),
                  ],
                  ["MRR?", formatCurrency(summary?.mrr ?? summary?.monthlyRevenue ?? 0)],
                ].map(([q, a]) => (
                  <div key={q}>
                    <p className="text-[11px] uppercase tracking-wide text-brand">{q}</p>
                    <p className="truncate text-sm font-bold">{a}</p>
                  </div>
                ))}
              </div>
              <AdminAnalyticsKpis summary={summary} />
              <div className="grid gap-4 xl:grid-cols-2">
                <PlatformRevenueSection summary={summary} range={filters.range} />
                <PlatformPaymentSection summary={summary} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <PlatformOccupancySection hostels={visibleHostels} />
                <PlatformPlanMixSection summary={summary} />
              </div>
              <TopHostelsSection hostels={hostels} onOpen={(id) => setFilters({ hostelId: id })} />
              {activeHostel && (
                <Card className="p-4 text-[13px] text-neutral-600">
                  Filtered to <strong className="text-neutral-900">{activeHostel.name}</strong>
                  {activeHostel.city ? ` · ${activeHostel.city}` : ""}
                  {activeHostel.ownerName ? ` · ${activeHostel.ownerName}` : ""} —{" "}
                  <button
                    className="font-semibold text-brand-ink underline"
                    onClick={() => setFilters({ hostelId: "all" })}
                  >
                    clear filter
                  </button>
                </Card>
              )}
            </>
          )}
        </div>
      </Protected>
    </DashboardShell>
  );
}
