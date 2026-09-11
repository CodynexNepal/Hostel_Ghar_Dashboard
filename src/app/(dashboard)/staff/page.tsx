"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/hooks/useToast";
import { Plus } from "lucide-react";

interface StaffRow {
  id: string;
  name: string;
  role: string;
  phone: string;
  shift: string;
  status: string;
}

const STAFF: StaffRow[] = [
  {
    id: "s-1",
    name: "Hari Bahadur",
    role: "Warden",
    phone: "9841000011",
    shift: "Night",
    status: "ACTIVE",
  },
  {
    id: "s-2",
    name: "Gita Sharma",
    role: "Cook",
    phone: "9841000022",
    shift: "Morning",
    status: "ACTIVE",
  },
  {
    id: "s-3",
    name: "Ram KC",
    role: "Cleaner",
    phone: "9841000033",
    shift: "Day",
    status: "ACTIVE",
  },
  {
    id: "s-4",
    name: "Suresh Yadav",
    role: "Accountant",
    phone: "9841000044",
    shift: "Day",
    status: "ON LEAVE",
  },
];

export default function StaffPage() {
  const { success } = useToast();
  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (s) => (
        <span>
          <span className="block font-semibold">{s.name}</span>
          <span className="block text-xs text-neutral-500">{s.phone}</span>
        </span>
      ),
    },
    { key: "role", header: "Role", sortable: true, render: (s) => s.role },
    {
      key: "shift",
      header: "Shift",
      sortable: true,
      render: (s) => <Badge tone="gray">{s.shift}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (s) => <Badge tone={s.status === "ACTIVE" ? "green" : "amber"}>{s.status}</Badge>,
    },
  ];
  return (
    <DashboardShell title="Staff" subtitle="Hostel Ghar / Staff — roles, shifts and contact.">
      <Protected permission="MANAGE_STAFF" redirectTo="/dashboard">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">{STAFF.length} staff members</p>
          <Button onClick={() => success("Invite sent", "Staff onboarding link created.")}>
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        </div>
        <DataTable<StaffRow>
          columns={columns}
          rows={STAFF}
          rowKey={(s) => s.id}
          searchableKeys={["name", "role"]}
          searchPlaceholder="Search staff…"
          mobileCard={(s) => (
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="block text-xs text-neutral-500">
                  {s.role} · {s.shift}
                </span>
              </span>
              <Badge tone={s.status === "ACTIVE" ? "green" : "amber"}>{s.status}</Badge>
            </div>
          )}
        />
        <Card className="mt-4 p-4 text-[13px] text-neutral-500">
          Attendance and payroll unlock with staff management on PRO and above.
        </Card>
      </Protected>
    </DashboardShell>
  );
}
