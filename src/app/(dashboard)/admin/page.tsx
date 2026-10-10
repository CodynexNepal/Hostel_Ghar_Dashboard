"use client";

import Link from "next/link";
import {
  BarChart3,
  BedDouble,
  Building2,
  CreditCard,
  Crown,
  LayoutDashboard,
  RefreshCw,
  Settings,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminKpiCards, type AdminKpi } from "@/components/admin/AdminKpiCards";
import { AdminActionsGrid, type AdminAction } from "@/components/admin/AdminActionsGrid";
import { AdminHostelsSpotlight } from "@/components/admin/AdminHostelsSpotlight";
import { AdminApprovalsQueue } from "@/components/admin/AdminApprovalsQueue";
import {
  PlatformRevenueSection,
  PlatformPaymentSection,
} from "@/components/admin/AdminAnalyticsSections";
import { formatCurrency, formatDateTime } from "@/lib/utils";

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

export default function SuperAdminPage() {
  const dash = useAdminDashboard();
  const { summary, isLoading, isRefetching, refetch, isLive, summaryError } = dash;

  const totalHostels = num(summary?.totalHostels) ?? (dash.hostels.length || null);
  const totalResidents = num(summary?.totalResidents ?? summary?.activeResidents);
  const mrr = num(summary?.mrr) ?? 0;
  const activePlans = num(summary?.stats?.mrrPaidPlans ?? summary?.activePlans);
  const occupancy = num(summary?.occupancyRate);
  const users = num(summary?.users);

  const kpis: AdminKpi[] = [
    {
      label: "Total Hostels",
      value: totalHostels != null ? String(totalHostels) : "—",
      hint: users != null ? `${users} registered users` : "platform-wide",
      icon: Building2,
      accent: "bg-brand",
    },
    {
      label: "Active Residents",
      value: totalResidents != null ? totalResidents.toLocaleString("en-NP") : "—",
      hint: (() => {
        const pending = num(summary?.pendingBookings);
        return pending != null && pending > 0 ? `${pending} pending bookings` : "all hostels";
      })(),
      icon: Users,
      accent: "bg-blue-500",
    },
    {
      label: "MRR",
      value: formatCurrency(mrr),
      hint:
        activePlans != null
          ? `${activePlans} paid plans`
          : (summary?.mrrBasis ?? "recurring revenue"),
      icon: Wallet,
      accent: "bg-emerald-500",
    },
    {
      label: "Occupancy",
      value: occupancy != null ? `${occupancy}%` : "—",
      hint:
        summary?.totalBeds != null
          ? `${summary.occupiedBeds ?? 0} / ${summary.totalBeds} beds used`
          : "beds occupied",
      icon: BarChart3,
      accent: "bg-violet-500",
    },
  ];

  const pendingN = dash.pendingTotal ?? dash.pendingApprovals.length;

  const actions: AdminAction[] = [
    {
      label: "Hostels",
      desc: "Create, assign owners, suspend",
      href: "/admin/hostels",
      icon: Building2,
      accent: "bg-brand-ink",
    },
    {
      label: "Owners",
      desc: "Onboard owners with photo",
      href: "/admin/owners",
      icon: Users,
      accent: "bg-blue-600",
    },
    {
      label: "Residents",
      desc: "Platform resident directory",
      href: "/admin/residents",
      icon: BedDouble,
      accent: "bg-violet-600",
    },
    {
      label: "Subscriptions",
      desc: "Approve payments, plans",
      href: "/admin/subscriptions",
      icon: Crown,
      accent: "bg-amber-500",
      badge: pendingN > 0 ? String(pendingN) : undefined,
      badgeTone: "amber",
    },
    {
      label: "Payments",
      desc: "Receipts & fee ledger",
      href: "/admin/payments",
      icon: CreditCard,
      accent: "bg-emerald-600",
    },
    {
      label: "Analytics",
      desc: "Growth, churn, collection",
      href: "/admin/analytics",
      icon: BarChart3,
      accent: "bg-indigo-600",
    },
    {
      label: "Platform QRs",
      desc: "Upload subscription payment QRs",
      href: "/admin/settings?tab=qrs",
      icon: Wallet,
      accent: "bg-teal-600",
    },
    {
      label: "Settings",
      desc: "Platform configuration",
      href: "/admin/settings",
      icon: Settings,
      accent: "bg-neutral-700",
    },
  ];

  function formatDateTime(generatedAt: string): import("react").ReactNode {
    const date = new Date(generatedAt);
    if (Number.isNaN(date.getTime())) return generatedAt;

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  return (
    <DashboardShell title="Platform Overview" subtitle="All hostels, owners, revenue and health.">
      <Protected roles={["SUPER_ADMIN"]} redirectTo="/dashboard">
        <div className="space-y-4 sm:space-y-5">
          {!isLoading && !isLive && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                Backend unreachable — showing empty state. {summaryError ?? ""}
              </p>
              <Button size="sm" variant="outline" onClick={refetch} className="shrink-0">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
              {isRefetching ? "Refreshing…" : isLive ? "Live from backend" : "Waiting for backend"}
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-400"}`}
                aria-hidden
              />
              {summary?.generatedAt && (
                <span className="text-neutral-400">
                  · Updated {formatDateTime(summary.generatedAt)}
                </span>
              )}
              {summary?.cacheLevel && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                  Cache {summary.cacheLevel}
                </span>
              )}
            </p>
            <Button size="sm" variant="ghost" onClick={refetch} className="text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          <AdminKpiCards kpis={kpis} isLoading={isLoading} />
          <section aria-label="Admin actions">
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">Manage everything</h2>
            <AdminActionsGrid actions={actions} isLoading={isLoading} />
          </section>
          <div className="grid gap-4 xl:grid-cols-2">
            <AdminApprovalsQueue
              rows={dash.pendingApprovals}
              total={dash.pendingTotal}
              isLoading={isLoading}
              error={dash.approvalsError}
              onRetry={refetch}
            />
            <AdminHostelsSpotlight
              hostels={dash.hostels}
              isLoading={isLoading}
              error={dash.hostelsError}
              onRetry={refetch}
            />
          </div>
          <section aria-label="Revenue and Fee Lifecycle" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Revenue Trend & Fee Lifecycle
                </h2>
                <p className="text-xs text-neutral-500">
                  Platform billing velocity, cash collected, and resident invoice collection states.
                </p>
              </div>
              <Link href="/admin/analytics">
                <Button size="sm" variant="ghost" className="text-xs">
                  Full analytics →
                </Button>
              </Link>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <PlatformRevenueSection summary={summary} range="1y" isLoading={isLoading} />
              <PlatformPaymentSection summary={summary} isLoading={isLoading} />
            </div>
          </section>
          <Card>
            <CardHeader
              title="Platform health"
              subtitle="Revenue, occupancy and collection at a glance"
            />
            <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
              {[
                {
                  t: "Monthly revenue",
                  v: formatCurrency(
                    num(summary?.health?.monthlyRevenue ?? summary?.monthlyRevenue) ?? 0
                  ),
                },
                {
                  t: "Total revenue",
                  v: formatCurrency(
                    num(summary?.health?.totalRevenue ?? summary?.totalRevenue) ?? 0
                  ),
                },
                {
                  t: "Pending dues",
                  v: formatCurrency(
                    num(summary?.health?.pendingDues ?? summary?.pendingAmount) ?? 0
                  ),
                },
                {
                  t: "Collected",
                  v: formatCurrency(num(summary?.paidAmount) ?? 0),
                },
                {
                  t: "Outstanding",
                  v: formatCurrency(num(summary?.outstandingAmount) ?? 0),
                },
                {
                  t: "Unpaid fees",
                  v: (num(summary?.unpaidFees) ?? 0).toLocaleString("en-NP"),
                },
                {
                  t: "Rooms",
                  v:
                    (summary?.health?.rooms ?? summary?.totalRooms != null)
                      ? String(summary?.health?.rooms ?? summary?.totalRooms)
                      : "—",
                },
                {
                  t: "Beds occupied",
                  v:
                    summary?.occupiedBeds != null
                      ? `${summary.occupiedBeds}${summary?.totalBeds ? ` / ${summary.totalBeds}` : ""}`
                      : "—",
                },
                {
                  t: "Collection rate",
                  v:
                    num(summary?.health?.collectionRate ?? summary?.collectionRate) != null
                      ? `${num(summary?.health?.collectionRate ?? summary?.collectionRate)}%`
                      : "—",
                },
              ].map((s) => (
                <div key={s.t} className="rounded-lg bg-surface-muted px-3.5 py-3">
                  <p className="text-xs text-neutral-500">{s.t}</p>
                  <p className="mt-0.5 truncate text-base font-bold text-neutral-900" title={s.v}>
                    {s.v}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-surface-border px-4 py-3 sm:px-5">
              <Link href="/admin/subscriptions">
                <Button size="sm">Approve payments</Button>
              </Link>
              <Link href="/admin/hostels">
                <Button size="sm" variant="outline">
                  Add hostel
                </Button>
              </Link>
              <Link href="/admin/owners">
                <Button size="sm" variant="outline">
                  Add owner
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </Protected>
    </DashboardShell>
  );
}
