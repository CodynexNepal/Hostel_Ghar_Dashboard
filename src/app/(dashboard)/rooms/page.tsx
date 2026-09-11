"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MOCK_ROOMS } from "@/lib/mock-data";
import type { Room } from "@/types/hostel";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { Plus } from "lucide-react";

export default function RoomsPage() {
  const { success } = useToast();
  const columns: Column<Room>[] = [
    {
      key: "roomNumber",
      header: "Room",
      sortable: true,
      render: (r) => (
        <span>
          <span className="block font-semibold">Room {r.roomNumber}</span>
          <span className="block text-xs text-neutral-500">
            Floor {r.floor} · {r.type}
          </span>
        </span>
      ),
    },
    {
      key: "occupied",
      header: "Occupancy",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          {r.occupied} / {r.capacity}
        </span>
      ),
    },
    {
      key: "monthlyRent",
      header: "Rent",
      sortable: true,
      render: (r) => <span className="font-semibold">{formatCurrency(r.monthlyRent)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => success("Room opened", `Room ${r.roomNumber}`)}
        >
          Manage
        </Button>
      ),
    },
  ];
  return (
    <DashboardShell title="Rooms" subtitle="Hostel Ghar / Hostel / Rooms — occupancy and rent.">
      <Protected permission="MANAGE_ROOMS" redirectTo="/hostel">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">{MOCK_ROOMS.length} rooms · 6 available</p>
          <Button onClick={() => success("Room builder opened", "Pick floor, type and capacity.")}>
            <Plus className="h-4 w-4" /> Add Room
          </Button>
        </div>
        <DataTable<Room>
          columns={columns}
          rows={MOCK_ROOMS}
          rowKey={(r) => r.id}
          searchableKeys={["roomNumber", "status", "type"]}
          searchPlaceholder="Search rooms…"
          mobileCard={(r) => (
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Room {r.roomNumber}</span>
                <span className="block text-xs text-neutral-500">
                  {r.occupied}/{r.capacity} beds · {formatCurrency(r.monthlyRent)}
                </span>
              </span>
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            </div>
          )}
        />
      </Protected>
    </DashboardShell>
  );
}
