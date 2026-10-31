"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search, Calendar, Download } from "lucide-react";
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
  PlatformRevenueSection,
  DailyRevenueSection,
  PaymentMethodsAndStatusSection,
  HostelAnalyticsSection,
  StudentAnalyticsSection,
  PlatformOccupancySection,
  PlatformPlanMixSection,
  TopHostelsSection,
  type RangeKey,
} from "@/components/admin/AdminAnalyticsSections";
import { downloadCSV, toCSV } from "@/lib/analytics";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "3m", label: "3 Months" },
  { key: "6m", label: "6 Months" },
  { key: "1y", label: "This Year" },
  { key: "custom", label: "Custom" },
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

  const [hostelSearch, setHostelSearch] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const filteredHostels = useMemo(() => {
    if (!hostelSearch.trim()) return hostels;
    const q = hostelSearch.toLowerCase();
    return hostels.filter(
      (h) => h.name.toLowerCase().includes(q) || (h.city && h.city.toLowerCase().includes(q))
    );
  }, [hostels, hostelSearch]);

  const activeHostel = hostels.find((h) => h.id === filters.hostelId) ?? null;
  const visibleHostels =
    filters.hostelId === "all" ? hostels : hostels.filter((h) => h.id === filters.hostelId);

  function exportAll() {
    const trend = Array.isArray(summary?.revenueTrend) ? summary!.revenueTrend! : [];
    const daily = summary?.dailyRevenue ?? [];

    downloadCSV(
      "platform-analytics.csv",
      toCSV(
        ["section", "label", "value"],
        [
          ["kpi", "Total Hostels", summary?.totalHostels ?? ""],
          ["kpi", "Total Registered Students", summary?.totalRegisteredStudents ?? ""],
          ["kpi", "Total Hostel Owners", summary?.totalOwners ?? ""],
          [
            "kpi",
            "Total Revenue Collected",
            summary?.totalRevenueCollected ?? summary?.paidAmount ?? "",
          ],
          ["kpi", "Outstanding Payments", summary?.outstandingAmount ?? ""],
          ["kpi", "Overdue Payments", summary?.overduePayments ?? summary?.overdueAmount ?? ""],
          [
            "kpi",
            "Total Active Residents",
            summary?.totalActiveResidents ?? summary?.totalResidents ?? "",
          ],
          ["kpi", "Monthly Recurring Revenue", summary?.mrr ?? ""],
          ...trend.map(
            (t) =>
              ["revenue_monthly", String(t.label ?? ""), Number(t.collected ?? 0)] as [
                string,
                string,
                string | number,
              ]
          ),
          ...daily.map(
            (d) =>
              ["revenue_daily", d.date, Number(d.amount ?? 0)] as [string, string, string | number]
          ),
          ...visibleHostels.map(
            (h) =>
              ["hostel_occupancy", h.name, Math.max(0, h.occupiedBeds || 0)] as [
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
      title="Platform Financial & Operational Analytics"
      subtitle="Complete revenue analytics, overdue collections, hostel health, and student trends."
    >
      <Protected roles={["SUPER_ADMIN"]} redirectTo="/dashboard">
        <div className="space-y-6">
          {/* Top action header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/admin" label="Platform overview" />
            <div className="flex flex-wrap items-center gap-2">
              {summary ? (
                <Badge tone="green">Live Database Data</Badge>
              ) : (
                <Badge tone="amber">Connecting...</Badge>
              )}

              {summary?.generatedAt && (
                <span className="text-xs text-neutral-400">
                  Updated {formatDateTime(summary.generatedAt)}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={exportAll}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>

          {summaryError && (
            <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              Summary endpoint alert: {summaryError}
            </p>
          )}

          {/* Date Range & Hostel Filter Controls */}
          <div className="space-y-3 rounded-xl border border-surface-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Range Tabs */}
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Date range filters"
              >
                <span className="mr-1 text-xs font-semibold uppercase text-neutral-400">
                  Range:
                </span>
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setFilters({ range: r.key })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filters.range === r.key
                        ? "bg-[#010101] text-[#C3FF7D]"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Hostel Select Dropdown & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search hostel..."
                    value={hostelSearch}
                    onChange={(e) => setHostelSearch(e.target.value)}
                    className="h-8 w-44 rounded-md border border-surface-border bg-neutral-50 pl-8 pr-2 text-xs text-neutral-800 placeholder-neutral-400 focus:border-brand-ink focus:outline-none"
                  />
                </div>

                <select
                  value={filters.hostelId}
                  onChange={(e) => setFilters({ hostelId: e.target.value })}
                  className="h-8 rounded-md border border-surface-border bg-white px-2.5 text-xs font-medium text-neutral-800"
                  aria-label="Filter by hostel"
                >
                  <option value="all">All Hostels ({hostels.length})</option>
                  {filteredHostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.city ? `(${h.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom date range inputs */}
            {filters.range === "custom" && (
              <div className="flex flex-wrap items-center gap-3 border-t border-surface-border pt-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500">From:</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => {
                      setCustomStart(e.target.value);
                      setFilters({ customStartDate: e.target.value });
                    }}
                    className="h-8 rounded border border-surface-border px-2 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500">To:</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => {
                      setCustomEnd(e.target.value);
                      setFilters({ customEndDate: e.target.value });
                    }}
                    className="h-8 rounded border border-surface-border px-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : error && !summary ? (
            <ErrorState title="Analytics unavailable" description={error.message} onRetry={retry} />
          ) : !summary && hostels.length === 0 ? (
            <EmptyState
              title="No analytics recorded yet"
              description="The platform hasn't reported data yet. Register hostels and process student payments to unlock live dashboards."
              action={
                <Link href="/admin/hostels">
                  <Button>Manage hostels</Button>
                </Link>
              }
            />
          ) : (
            <>
              {/* 1. Main 8 Core KPI Cards */}
              <AdminAnalyticsKpis summary={summary} />

              {/* 2. Revenue Analytics Section */}
              <div className="grid gap-6 xl:grid-cols-2">
                <PlatformRevenueSection summary={summary} range={filters.range} />
                <DailyRevenueSection summary={summary} />
              </div>

              {/* 3. Payment Methods & Status Distribution */}
              <PaymentMethodsAndStatusSection summary={summary} />

              {/* 4. Hostel Analytics Section */}
              <HostelAnalyticsSection
                summary={summary}
                hostels={hostels}
                onSelectHostel={(hid) => setFilters({ hostelId: hid })}
              />

              {/* 5. Student Growth & Health Analytics */}
              <StudentAnalyticsSection summary={summary} />

              {/* 6. Capacity & Subscription Plan Mix */}
              <div className="grid gap-6 xl:grid-cols-2">
                <PlatformOccupancySection hostels={visibleHostels} />
                <PlatformPlanMixSection summary={summary} />
              </div>

              {/* 7. Inventory List */}
              <TopHostelsSection hostels={hostels} onOpen={(id) => setFilters({ hostelId: id })} />

              {activeHostel && (
                <Card className="p-4 text-[13px] text-neutral-600">
                  Filtered view active for{" "}
                  <strong className="text-neutral-900">{activeHostel.name}</strong>
                  {activeHostel.city ? ` · ${activeHostel.city}` : ""} —{" "}
                  <button
                    className="font-semibold text-neutral-900 underline"
                    onClick={() => setFilters({ hostelId: "all" })}
                  >
                    Reset to platform-wide
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
