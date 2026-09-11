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
import { MOCK_RESIDENTS } from "@/lib/mock-data";
import type { Resident } from "@/types/resident";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";

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
          {r.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
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
  return (
    <DashboardShell
      title="Residents"
      subtitle="Hostel Ghar / Residents — manage profiles, rooms and dues."
    >
      <Protected permission="VIEW_RESIDENTS">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            {MOCK_RESIDENTS.length} residents · 10 / 10 FREE capacity
          </p>
          <FeatureGate permission="ADD_RESIDENT">
            <Link href="/residents/add">
              <Button>Add Resident</Button>
            </Link>
          </FeatureGate>
        </div>
        <DataTable<Resident>
          columns={COLUMNS(
            (r) => success("Edit opened", r.name),
            (r) => success("Resident removed", r.name)
          )}
          rows={MOCK_RESIDENTS}
          rowKey={(r) => r.id}
          searchableKeys={["name", "phone", "roomNumber"]}
          searchPlaceholder="Search residents…"
          mobileCard={(r) => (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-xs font-bold">
                {r.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
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
