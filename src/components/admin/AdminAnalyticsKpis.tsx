"use client";

import {
  Building2,
  Users,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency } from "@/lib/utils";
import type { AdminSummaryWithCounts } from "@/lib/hostelGhar";

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Platform KPI strip for the admin analytics page.
 * Displays all 8 requested core KPI cards:
 * 1. Total Hostels
 * 2. Total Registered Students
 * 3. Total Hostel Owners
 * 4. Total Revenue Collected
 * 5. Outstanding Payments
 * 6. Overdue Payments
 * 7. Total Active Residents
 * 8. Monthly Recurring Revenue (MRR)
 */
export function AdminAnalyticsKpis({ summary }: { summary: AdminSummaryWithCounts | null }) {
  // 1. Total Hostels
  const hostels = num(summary?.totalHostels ?? summary?.stats?.totalHostels);

  // 2. Total Registered Students
  const regStudents = num(
    summary?.totalRegisteredStudents ??
      summary?.studentAnalytics?.totalRegistered ??
      summary?.stats?.totalRegisteredStudents ??
      summary?.totalResidents
  );

  // 3. Total Hostel Owners
  const owners = num(summary?.totalOwners ?? summary?.stats?.totalOwners);

  // 4. Total Revenue Collected
  const revenueCollected =
    num(
      summary?.totalRevenueCollected ??
        summary?.paidAmount ??
        summary?.totalRevenue ??
        summary?.stats?.totalRevenueCollected
    ) ?? 0;

  // 5. Outstanding Payments
  const outstanding =
    num(
      summary?.outstandingAmount ?? summary?.pendingAmount ?? summary?.stats?.outstandingAmount
    ) ?? 0;

  // 6. Overdue Payments
  const overdue =
    num(summary?.overduePayments ?? summary?.overdueAmount ?? summary?.stats?.overdueAmount) ?? 0;

  // 7. Total Active Residents
  const activeResidents = num(
    summary?.totalActiveResidents ??
      summary?.activeResidents ??
      summary?.studentAnalytics?.totalActive ??
      summary?.stats?.totalResidents
  );

  // 8. MRR
  const mrr = num(summary?.mrr ?? summary?.stats?.mrr ?? summary?.monthlyRevenue) ?? 0;
  const activePlans =
    typeof summary?.activePlans === "number"
      ? summary.activePlans
      : Number(summary?.activePlans) || num(summary?.stats?.mrrPaidPlans);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Platform 8 Core KPIs">
      {/* 1. Total Hostels */}
      <StatCard
        icon={Building2}
        title="Total Hostels"
        value={hostels !== null ? String(hostels) : "—"}
        delta={summary ? "Live" : "No data"}
        deltaUp={summary !== null}
        hint="registered on platform"
      />

      {/* 2. Total Registered Students */}
      <StatCard
        icon={GraduationCap}
        title="Total Registered Students"
        value={regStudents !== null ? regStudents.toLocaleString("en-NP") : "—"}
        delta={summary ? "Live" : "No data"}
        deltaUp={summary !== null}
        hint="lifetime student accounts"
      />

      {/* 3. Total Hostel Owners */}
      <StatCard
        icon={UserCheck}
        title="Total Hostel Owners"
        value={owners !== null ? String(owners) : "—"}
        delta={summary ? "Verified" : "No data"}
        deltaUp={summary !== null}
        hint="platform property managers"
      />

      {/* 4. Total Revenue Collected */}
      <StatCard
        icon={CheckCircle2}
        title="Total Revenue Collected"
        value={formatCurrency(revenueCollected)}
        delta="Verified"
        deltaUp
        hint="actual payments received"
      />

      {/* 5. Outstanding Payments */}
      <StatCard
        icon={Wallet}
        title="Outstanding Payments"
        value={formatCurrency(outstanding)}
        delta={outstanding > 0 ? "Pending" : "Cleared"}
        deltaUp={outstanding === 0}
        hint="unpaid & partial balances"
      />

      {/* 6. Overdue Payments */}
      <StatCard
        icon={AlertTriangle}
        title="Overdue Payments"
        value={formatCurrency(overdue)}
        delta={overdue > 0 ? "Requires action" : "Zero overdue"}
        deltaUp={overdue === 0}
        hint="past payment due date"
      />

      {/* 7. Total Active Residents */}
      <StatCard
        icon={Users}
        title="Total Active Residents"
        value={activeResidents !== null ? activeResidents.toLocaleString("en-NP") : "—"}
        delta={summary ? "Occupying beds" : "No data"}
        deltaUp={summary !== null}
        hint="currently checked-in"
      />

      {/* 8. MRR */}
      <StatCard
        icon={TrendingUp}
        title="Monthly Recurring Revenue"
        value={formatCurrency(mrr)}
        delta={activePlans != null ? `${activePlans} active plans` : (summary?.mrrBasis ?? "MRR")}
        deltaUp
        hint="recurring subscriptions"
      />
    </div>
  );
}
