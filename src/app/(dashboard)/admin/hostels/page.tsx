"use client";
import { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { BackLink } from "@/components/ui/BackLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MOCK_HOSTELS } from "@/lib/mock-data";
import type { Hostel } from "@/types/hostel";
import { useToast } from "@/hooks/useToast";
import { Ban, CheckCircle2, Plus } from "lucide-react";

export default function AdminHostelsPage() {
  const { success } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>(MOCK_HOSTELS);
  const columns: Column<Hostel>[] = [
    {
      key: "name",
      header: "Hostel",
      sortable: true,
      render: (h) => (
        <span>
          <span className="block font-semibold">{h.name}</span>
          <span className="block text-xs text-neutral-500">{h.address}</span>
        </span>
      ),
    },
    { key: "ownerName", header: "Owner", sortable: true, render: (h) => h.ownerName },
    {
      key: "occupiedBeds",
      header: "Occupancy",
      sortable: true,
      render: (h) => `${h.occupiedBeds}/${h.totalBeds}`,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (h) => <Badge tone={h.status === "ACTIVE" ? "green" : "amber"}>{h.status}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (h) => (
        <span className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => success("Hostel opened", h.name)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Toggle ${h.name}`}
            onClick={() => {
              setHostels((prev) =>
                prev.map((x) =>
                  x.id === h.id
                    ? { ...x, status: x.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }
                    : x
                )
              );
              success("Status updated", h.name);
            }}
          >
            {h.status === "ACTIVE" ? (
              <Ban className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-700" />
            )}
          </Button>
        </span>
      ),
    },
  ];
  return (
    <DashboardShell
      title="Hostels"
      subtitle="Hostel Ghar / Admin / Hostels — create, suspend, manage."
    >
      <BackLink href="/admin" label="Platform overview" />
      <div className="mb-4 mt-3 flex items-center justify-between">
        <p className="text-sm text-neutral-500">{hostels.length} hostels</p>
        <Button onClick={() => success("Hostel created", "Onboarding email sent to owner.")}>
          <Plus className="h-4 w-4" /> Create Hostel
        </Button>
      </div>
      <DataTable<Hostel>
        columns={columns}
        rows={hostels}
        rowKey={(h) => h.id}
        searchableKeys={["name", "ownerName", "city"]}
        searchPlaceholder="Search hostels…"
        mobileCard={(h) => (
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{h.name}</span>
              <span className="block text-xs text-neutral-500">
                {h.ownerName} · {h.occupiedBeds}/{h.totalBeds}
              </span>
            </span>
            <Badge tone={h.status === "ACTIVE" ? "green" : "amber"}>{h.status}</Badge>
          </div>
        )}
      />
      <Card className="mt-4 p-4 text-[13px] text-neutral-500">
        Suspending a hostel immediately blocks owner logins and resident payments — backend enforces
        via <span className="font-medium">PATCH /hostels/:id/status</span>.
      </Card>
    </DashboardShell>
  );
}
