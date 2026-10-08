"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { AdminKpiCards, type AdminKpi } from "@/components/admin/AdminKpiCards";
import { useAdminPayments, useHostelOptions, type AdminPaymentRow } from "@/hooks/useAdminPayments";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import type { PaymentStatus } from "@/types/resident";

const selectClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand";

type StatusFilter = "ALL" | PaymentStatus;

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "PAID", label: "Paid" },
  { id: "PENDING", label: "Pending" },
  { id: "PARTIAL", label: "Partial" },
  { id: "OVERDUE", label: "Overdue" },
];

/** Paid vs. payable bar for one ledger row. */
function PaymentProgress({ paid, total }: { paid: number; total: number }) {
  if (total <= 0) {
    return <span className="text-xs text-neutral-400">No fee</span>;
  }
  const pct = Math.min(100, Math.max(0, Math.round((paid / total) * 100)));
  const tone = pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-neutral-100">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

const COLUMNS: Column<AdminPaymentRow>[] = [
  {
    key: "residentName",
    header: "Resident",
    sortable: true,
    render: (r) => (
      <span className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-neutral-600">
          {initials(r.residentName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{r.residentName}</span>
          <span className="block truncate text-xs text-neutral-500">
            {r.phone || r.email || "—"}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: "hostelName",
    header: "Hostel / Room",
    sortable: true,
    render: (r) => (
      <span className="block min-w-0">
        <span className="block max-w-[160px] truncate" title={r.hostelName}>
          {r.hostelName}
        </span>
        <span className="block text-xs text-neutral-500">
          {r.roomNumber ? `Room ${r.roomNumber}` : "Unassigned"}
          {r.bedNumber ? ` · ${r.bedNumber}` : ""}
        </span>
      </span>
    ),
  },
  {
    key: "billingLabel",
    header: "Period",
    sortable: true,
    render: (r) => <span className="text-neutral-700">{r.billingLabel}</span>,
  },
  {
    key: "totalPayable",
    header: "Amount",
    sortable: true,
    render: (r) => (
      <span className="block">
        <span className="block font-semibold text-neutral-900">
          {formatCurrency(r.totalPayable || r.amount)}
        </span>
        <span className="block text-xs text-neutral-500">{formatCurrency(r.paidAmount)} paid</span>
      </span>
    ),
  },
  {
    key: "dueAmount",
    header: "Due",
    sortable: true,
    render: (r) => (
      <span className="block">
        <span
          className={
            r.dueAmount > 0
              ? "block font-semibold text-red-600"
              : "block font-semibold text-neutral-400"
          }
        >
          {r.dueAmount > 0 ? formatCurrency(r.dueAmount) : "Settled"}
        </span>
        <PaymentProgress paid={r.paidAmount} total={r.totalPayable || r.amount} />
      </span>
    ),
  },
  {
    key: "dueDate",
    header: "Due date",
    sortable: true,
    render: (r) => <span className="text-neutral-600">{formatDate(r.dueDate)}</span>,
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
  },
];

const MOBILE_CARD = (r: AdminPaymentRow) => (
  <div className="flex items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-neutral-600">
      {initials(r.residentName)}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-neutral-900">{r.residentName}</p>
      <p className="truncate text-xs text-neutral-500">
        {r.hostelName}
        {r.roomNumber ? ` · Room ${r.roomNumber}` : ""}
      </p>
      <p className="mt-1 text-xs text-neutral-600">
        {formatCurrency(r.totalPayable || r.amount)} · {r.billingLabel} ·{" "}
        <span className={r.dueAmount > 0 ? "font-semibold text-red-600" : ""}>
          {r.dueAmount > 0 ? `${formatCurrency(r.dueAmount)} due` : "Settled"}
        </span>
      </p>
      <div className="mt-2">
        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
      </div>
    </div>
  </div>
);

/**
 * Admin Payments — platform-wide resident fee ledger.
 *
 * Read-only: a super admin sees every hostel's current billing cycle but
 * records payments from the owning hostel's own Fees page.
 */
export default function AdminPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [hostelFilter, setHostelFilter] = useState("ALL");
  const { rows, summary, hostels, failedHostelCount, error, isLoading, retry, refetch } =
    useAdminPayments();

  const hostelOptions = useHostelOptions(hostels, rows);

  const counts = useMemo(() => {
    const acc: Record<StatusFilter, number> = {
      ALL: rows.length,
      PAID: 0,
      PENDING: 0,
      PARTIAL: 0,
      OVERDUE: 0,
    };
    for (const r of rows) acc[r.status] += 1;
    return acc;
  }, [rows]);

  const visible = useMemo(
    () =>
      rows
        .filter((r) => statusFilter === "ALL" || r.status === statusFilter)
        .filter((r) => hostelFilter === "ALL" || r.hostelId === hostelFilter),
    [rows, statusFilter, hostelFilter]
  );

  const totals = useMemo(
    () => ({
      collected: rows.reduce((s, r) => s + r.paidAmount, 0),
      outstanding: rows.reduce((s, r) => s + r.dueAmount, 0),
      billed: rows.reduce((s, r) => s + (r.totalPayable || r.amount), 0),
    }),
    [rows]
  );

  const kpis: AdminKpi[] = [
    {
      label: "Collected",
      value: formatCurrency(totals.collected),
      hint: "current billing cycle",
      icon: CheckCircle2,
      accent: "bg-emerald-500",
    },
    {
      label: "Outstanding",
      value: formatCurrency(totals.outstanding),
      hint: totals.outstanding > 0 ? "needs follow-up" : "all settled",
      icon: AlertTriangle,
      accent: "bg-red-500",
    },
    {
      label: "Collection Rate",
      value: totals.billed > 0 ? `${Math.round((totals.collected / totals.billed) * 100)}%` : "—",
      hint: `of ${formatCurrency(totals.billed)} billed`,
      icon: TrendingUp,
      accent: "bg-brand",
    },
    {
      label: "Active Plans",
      value: (summary?.activePlans ?? "—").toString(),
      hint: "paid subscriptions",
      icon: Building2,
      accent: "bg-violet-600",
    },
  ];

  const hasFilters = statusFilter !== "ALL" || hostelFilter !== "ALL";

  return (
    <DashboardShell
      title="Payments"
      subtitle="Hostel Ghar / Admin / Payments — resident fee ledger across the platform."
    >
      <Protected roles={["SUPER_ADMIN"]} redirectTo="/dashboard">
        <div className="space-y-4 sm:space-y-5">
          <BackLink href="/admin" label="Platform overview" />

          <AdminKpiCards kpis={kpis} isLoading={isLoading} />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  aria-pressed={statusFilter === tab.id}
                  className={
                    statusFilter === tab.id
                      ? "rounded-md border border-brand-ink bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink"
                      : "rounded-md border border-surface-border bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-surface-muted"
                  }
                >
                  {tab.label}
                  {counts[tab.id] > 0 ? ` (${counts[tab.id]})` : ""}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="w-full sm:w-56">
                <label
                  htmlFor="payment-hostel-filter"
                  className="mb-1.5 block text-[13px] font-medium text-neutral-800"
                >
                  Filter by hostel
                </label>
                <select
                  id="payment-hostel-filter"
                  className={selectClass}
                  value={hostelFilter}
                  onChange={(event) => setHostelFilter(event.target.value)}
                  disabled={isLoading || hostelOptions.length === 0}
                >
                  <option value="ALL">All hostels ({hostelOptions.length})</option>
                  {hostelOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="w-full sm:w-auto"
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : error ? (
            <ErrorState
              title="Couldn't load payments"
              description={error.message}
              onRetry={retry}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No payments found"
              description="Once hostels generate monthly fees for their residents, they will appear here."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title="No payments match these filters"
              description="Pick another status or hostel to see more."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setHostelFilter("ALL");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <DataTable<AdminPaymentRow>
              columns={COLUMNS}
              rows={visible}
              rowKey={(r) => r.id}
              searchableKeys={["residentName", "hostelName", "roomNumber", "billingLabel"]}
              searchPlaceholder="Search resident, hostel or room…"
              pageSize={10}
              mobileCard={MOBILE_CARD}
            />
          )}

          <Card className="p-4 text-[13px] text-neutral-500">
            <span className="flex items-start gap-2">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Read-only ledger of each resident&rsquo;s current billing cycle. Record payments and
                mark dues from the owning hostel&rsquo;s Fees page.
                {failedHostelCount > 0 && (
                  <span className="mt-1 block font-medium text-amber-700">
                    {failedHostelCount} hostel{failedHostelCount > 1 ? "s" : ""} failed to load —
                    figures above are incomplete. Refresh to retry.
                  </span>
                )}
                {hasFilters && (
                  <span className="mt-1 block">
                    Showing {visible.length} of {rows.length} ledger rows.
                  </span>
                )}
              </span>
            </span>
          </Card>
        </div>
      </Protected>
    </DashboardShell>
  );
}
