"use client";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { BackLink } from "@/components/ui/BackLink";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeatureGate } from "@/components/common/FeatureGate";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import type { Resident } from "@/types/resident";
import { formatDate, formatCurrency, initials } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { getHostelId } from "@/lib/axios";
import { hostelGhar, normalizeResident, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { HostelDetail } from "@/lib/api-types";

/** Resolve the hostel id in priority order: session → cookie → first hostel. */
async function resolveHostelId(preferred?: string | null): Promise<string | null> {
  if (preferred) return preferred;
  const fromCookie = getHostelId();
  if (fromCookie) return fromCookie;
  // No hostel in session yet — list hostels (limit=1) and use the first.
  // Cookies (HttpOnly access_token) are sent automatically via withCredentials.
  const list = await hostelGhar.hostels.list({ limit: 1 });
  const items = toPaginated<HostelDetail>(list.data).items;
  return items[0]?.id ?? null;
}

const COLUMNS = (
  onEdit: (r: Resident) => void,
  onRemove: (r: Resident) => void
): Column<Resident>[] => [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (r: Resident) => (
      <span className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-bold">
          {initials(r.name)}
        </span>
        <span>
          <span className="block font-semibold text-neutral-900">{r.name}</span>
          <span className="block text-xs text-neutral-500">{r.phone}</span>
        </span>
      </span>
    ),
  },
  {
    key: "roomNumber",
    header: "Room",
    sortable: true,
    render: (r: Resident) => (
      <span className="font-medium">
        Room {r.roomNumber} · Bed {r.bedNumber}
      </span>
    ),
  },
  {
    key: "paymentStatus",
    header: "Payment",
    sortable: true,
    render: (r: Resident) => <Badge tone={statusTone(r.paymentStatus)}>{r.paymentStatus}</Badge>,
  },
  {
    key: "joinedDate",
    header: "Joined",
    sortable: true,
    render: (r: Resident) => <span className="text-neutral-600">{formatDate(r.joinedDate)}</span>,
  },
  {
    key: "monthlyRent",
    header: "Rent",
    sortable: true,
    render: (r: Resident) => <span className="font-semibold">{formatCurrency(r.monthlyRent)}</span>,
  },
  {
    key: "actions",
    header: "Actions",
    render: (r: Resident) => (
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="sm" aria-label={`Edit ${r.name}`} onClick={() => onEdit(r)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Remove ${r.name}`}
          onClick={() => onRemove(r)}
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </span>
    ),
  },
];

export default function ResidentsPage() {
  const { success } = useToast();
  const { user } = useAuth();
  // GET /hostels/{id}/residents — access_token cookie is attached automatically
  // (withCredentials) on this request and every other request; when the cookie
  // is readable we also mirror it as `Authorization: Bearer …` in the interceptor.
  const {
    data: residents,
    error,
    isLoading,
    retry,
    refetch,
  } = useApi<Resident[]>(async () => {
    const hostelId = await resolveHostelId(user?.hostelId);
    if (!hostelId) return [];
    const res = await hostelGhar.hostels.residents(hostelId);
    const raw = unwrap<unknown>(res.data);
    return toPaginated<unknown>(raw).items.map(normalizeResident);
  }, [user?.hostelId]);
  const rows = residents ?? [];
  return (
    <DashboardShell
      title="Residents"
      subtitle="Hostel Ghar / Residents — manage profiles, rooms and dues."
    >
      <Protected permission="VIEW_RESIDENTS">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            {isLoading ? "Loading residents…" : `${rows.length} residents`}
          </p>
          <FeatureGate permission="ADD_RESIDENT">
            <Link href="/residents/add">
              <Button>Add Resident</Button>
            </Link>
          </FeatureGate>
        </div>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState title="Couldn't load residents" description={error.message} onRetry={retry} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No residents yet"
            description="Add your first resident to get started."
            action={
              <Link href="/residents/add">
                <Button>Add Resident</Button>
              </Link>
            }
          />
        ) : (
          <DataTable<Resident>
            columns={COLUMNS(
              (r) => success("Edit opened", r.name),
              (r) => {
                success("Resident removed", r.name);
                refetch();
              }
            )}
            rows={rows}
            rowKey={(r) => r.id}
            searchableKeys={["name", "phone", "roomNumber"]}
            searchPlaceholder="Search residents…"
            mobileCard={(r) => (
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-xs font-bold">
                  {initials(r.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="block text-xs text-neutral-500">
                    Room {r.roomNumber} · {formatCurrency(r.monthlyRent)}
                  </span>
                </span>
                <Badge tone={statusTone(r.paymentStatus)}>{r.paymentStatus}</Badge>
              </div>
            )}
          />
        )}
        <Card className="mt-4 border-dashed p-4 text-[13px] text-neutral-500">
          Bulk import, unlimited residents and exports unlock on{" "}
          <Link href="/subscription" className="font-semibold text-neutral-900 underline">
            PRO
          </Link>
          .
        </Card>
        <div className="mt-4 hidden">
          <BackLink href="/dashboard" label="Dashboard" />
        </div>
      </Protected>
    </DashboardShell>
  );
}
