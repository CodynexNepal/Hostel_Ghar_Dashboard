"use client";

import { useMemo, useState } from "react";
import { BedDouble, Building2, RefreshCw, Users, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { AdminKpiCards, type AdminKpi } from "@/components/admin/AdminKpiCards";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import {
  hostelGhar,
  normalizeHostelList,
  normalizeResident,
  toPaginated,
  unwrap,
} from "@/lib/hostelGhar";
import type { Hostel } from "@/types/hostel";
import type { Resident } from "@/types/resident";
import { formatCurrency, formatDate, initials } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand";

/** A resident plus the hostel they belong to — the platform directory row. */
interface AdminResidentRow extends Resident {
  hostelId: string;
  hostelName: string;
}

/** Guard against fanning out to an unbounded number of hostels. */
const MAX_HOSTELS = 100;
const RESIDENT_LIMIT = 500;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Map a backend resident payload to a row, resolving its hostel from the
 *  payload itself or from the hostel we fetched it under. */
function toAdminRow(raw: unknown, fallback?: Hostel): AdminResidentRow {
  const resident = normalizeResident(raw);
  const src = (raw ?? {}) as Record<string, unknown>;
  const hostelObj = (src.hostel ?? src.hostelDetails ?? {}) as Record<string, unknown>;
  const hostelId =
    str(src.hostelId) || str(src.hostel_id) || str(hostelObj.id) || fallback?.id || "";
  const hostelName =
    str(src.hostelName) || str(src.hostel_name) || str(hostelObj.name) || fallback?.name || "—";
  return { ...resident, hostelId, hostelName };
}

/** normalizeResident falls back to a timestamp id, so de-duplicate defensively
 *  to keep React keys stable when a payload omits ids. */
function withUniqueIds(rows: AdminResidentRow[]): AdminResidentRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    let id = row.id;
    let n = 2;
    while (seen.has(id)) id = `${row.id}-${n++}`;
    seen.add(id);
    return { ...row, id };
  });
}

/**
 * Load the platform-wide resident directory.
 *
 * There is no dedicated GET /admin/residents endpoint, so this follows the
 * super-admin bypass convention used elsewhere in the app:
 *   1. GET /owner/residents — returns every resident visible to a super admin
 *      in one call, already carrying hostel info.
 *   2. Fallback: list hostels, then GET /hostels/:id/residents for each one and
 *      stitch the rows together (a failure on one hostel never fails the page).
 */
async function loadPlatformResidents(): Promise<AdminResidentRow[]> {
  try {
    const res = await hostelGhar.owner.residents({ limit: RESIDENT_LIMIT });
    const rows = withUniqueIds(
      toPaginated<unknown>(unwrap<unknown>(res.data)).items.map((raw) => toAdminRow(raw))
    );
    if (rows.length > 0) return rows;
  } catch {
    /* fall through to the per-hostel fan-out */
  }

  const hostelsRes = await hostelGhar.admin.listHostels({ limit: MAX_HOSTELS });
  const hostels = normalizeHostelList(hostelsRes.data).slice(0, MAX_HOSTELS);

  const settled = await Promise.allSettled(
    hostels.map(async (hostel) => {
      const res = await hostelGhar.hostels.residents(hostel.id, { limit: RESIDENT_LIMIT });
      const raw = unwrap<unknown>(res.data);
      return toPaginated<unknown>(raw).items.map((item) => toAdminRow(item, hostel));
    })
  );

  return withUniqueIds(
    settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
  );
}

const COLUMNS: Column<AdminResidentRow>[] = [
  {
    key: "name",
    header: "Resident",
    sortable: true,
    render: (r) => (
      <span className="flex items-center gap-2.5">
        {r.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.avatarUrl}
            alt={`${r.name} avatar`}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold">
            {initials(r.name)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{r.name}</span>
          <span className="block truncate text-xs text-neutral-500">
            {r.phone || r.email || "—"}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: "hostelName",
    header: "Hostel",
    sortable: true,
    render: (r) => (
      <span className="block max-w-[180px] truncate" title={r.hostelName}>
        {r.hostelName}
      </span>
    ),
  },
  {
    key: "roomNumber",
    header: "Room / Bed",
    sortable: true,
    render: (r) =>
      r.roomNumber ? (
        <span className="font-medium">
          {r.roomNumber}
          {r.bedNumber ? ` · ${r.bedNumber}` : ""}
          {r.roomType ? (
            <span className="ml-1.5 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              {r.roomType}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="text-xs text-neutral-400">Unassigned</span>
      ),
  },
  {
    key: "paymentStatus",
    header: "Payment",
    sortable: true,
    render: (r) => <Badge tone={statusTone(r.paymentStatus)}>{r.paymentStatus}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
  },
  {
    key: "joinedDate",
    header: "Joined",
    sortable: true,
    render: (r) => <span className="text-neutral-600">{formatDate(r.joinedDate)}</span>,
  },
  {
    key: "monthlyRent",
    header: "Rent",
    sortable: true,
    render: (r) => <span className="font-semibold">{formatCurrency(r.monthlyRent)}</span>,
  },
];

const MOBILE_CARD = (r: AdminResidentRow) => (
  <div className="flex items-start gap-3">
    {r.avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={r.avatarUrl}
        alt={`${r.name} avatar`}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    ) : (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold">
        {initials(r.name)}
      </span>
    )}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-neutral-900">{r.name}</p>
      <p className="truncate text-xs text-neutral-500">{r.hostelName}</p>
      <p className="mt-1 truncate text-xs text-neutral-500">
        {r.roomNumber ? `Room ${r.roomNumber}${r.bedNumber ? ` · ${r.bedNumber}` : ""} · ` : ""}
        {formatCurrency(r.monthlyRent)}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
        <Badge tone={statusTone(r.paymentStatus)}>{r.paymentStatus}</Badge>
      </div>
    </div>
  </div>
);

export default function AdminResidentsPage() {
  const { error: toastError } = useToast();
  const [hostelFilter, setHostelFilter] = useState("ALL");
  const { data, error, isLoading, isRefetching, retry, refetch } = useApi<AdminResidentRow[]>(
    loadPlatformResidents,
    []
  );

  /** Stable empty array so the memoized filters don't churn every render. */
  const all = useMemo(() => data ?? [], [data]);

  /** Distinct hostels present in the loaded rows, for the filter dropdown. */
  const hostels = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of all) if (r.hostelId) map.set(r.hostelId, r.hostelName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);

  const rows = useMemo(
    () => (hostelFilter === "ALL" ? all : all.filter((r) => r.hostelId === hostelFilter)),
    [all, hostelFilter]
  );

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "ACTIVE").length;
    const dues = rows.filter(
      (r) => r.paymentStatus === "PENDING" || r.paymentStatus === "OVERDUE"
    ).length;
    const rent = rows.reduce((sum, r) => sum + (r.monthlyRent || 0), 0);
    return { active, dues, rent };
  }, [rows]);

  const kpis: AdminKpi[] = [
    {
      label: "Total Residents",
      value: rows.length.toLocaleString("en-NP"),
      hint: hostels.length ? `across ${hostels.length} hostels` : "platform-wide",
      icon: Users,
      accent: "bg-violet-600",
    },
    {
      label: "Active",
      value: stats.active.toLocaleString("en-NP"),
      hint: rows.length ? `${Math.round((stats.active / rows.length) * 100)}% of listed` : "—",
      icon: BedDouble,
      accent: "bg-emerald-500",
    },
    {
      label: "Pending Dues",
      value: stats.dues.toLocaleString("en-NP"),
      hint: stats.dues ? "needs follow-up" : "all settled",
      icon: Wallet,
      accent: "bg-amber-500",
    },
    {
      label: "Monthly Rent",
      value: formatCurrency(stats.rent),
      hint: "listed residents",
      icon: Building2,
      accent: "bg-brand",
    },
  ];

  return (
    <DashboardShell
      title="Residents"
      subtitle="Hostel Ghar / Admin / Residents — every resident across the platform."
    >
      <Protected roles={["SUPER_ADMIN"]} redirectTo="/dashboard">
        <div className="space-y-4 sm:space-y-5">
          <BackLink href="/admin" label="Platform overview" />

          <AdminKpiCards kpis={kpis} isLoading={isLoading} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <label
                htmlFor="hostel-filter"
                className="mb-1.5 block text-[13px] font-medium text-neutral-800"
              >
                Filter by hostel
              </label>
              <select
                id="hostel-filter"
                className={selectClass}
                value={hostelFilter}
                onChange={(event) => setHostelFilter(event.target.value)}
                disabled={isLoading || hostels.length === 0}
              >
                <option value="ALL">All hostels ({hostels.length})</option>
                {hostels.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              loading={isRefetching}
              className="w-full sm:w-auto"
            >
              {!isRefetching && <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : error ? (
            <ErrorState
              title="Couldn't load residents"
              description={error.message}
              onRetry={retry}
            />
          ) : all.length === 0 ? (
            <EmptyState
              title="No residents found"
              description="Once hostels start admitting residents, they will appear here platform-wide."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No residents in this hostel"
              description="Pick another hostel or reset the filter to see everyone."
              action={
                <Button variant="outline" onClick={() => setHostelFilter("ALL")}>
                  Show all hostels
                </Button>
              }
            />
          ) : (
            <DataTable<AdminResidentRow>
              columns={COLUMNS}
              rows={rows}
              rowKey={(r) => r.id}
              searchableKeys={["name", "phone", "email", "hostelName", "roomNumber"]}
              searchPlaceholder="Search name, phone, hostel or room…"
              pageSize={10}
              mobileCard={MOBILE_CARD}
            />
          )}

          <p className="text-xs text-neutral-400">
            Showing up to {RESIDENT_LIMIT} residents per hostel. Read-only directory — edit
            residents from the owning hostel dashboard.
            {error && (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() =>
                  toastError("Some hostels failed", "Retry to load any missing hostels.")
                }
              >
                Some hostels failed to load
              </button>
            )}
          </p>
        </div>
      </Protected>
    </DashboardShell>
  );
}
