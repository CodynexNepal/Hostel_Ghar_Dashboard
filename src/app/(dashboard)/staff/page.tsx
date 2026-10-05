"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StaffModal, type StaffModalMode } from "@/components/staff/StaffModal";
import { staffApi } from "@/lib/staff-api";
import type { StaffMember } from "@/lib/staff-store";
import { useToast } from "@/hooks/useToast";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";

export default function StaffPage() {
  const { success, error: toastError } = useToast();
  const [staffList, setStaffList] = useState<StaffMember[]>(() => staffApi.getLocalStaff());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<StaffModalMode>("create");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  const refreshStaff = useCallback(async () => {
    try {
      const res = await staffApi.get();
      if (Array.isArray(res.data)) {
        setStaffList(res.data);
      }
    } catch {
      setStaffList(staffApi.getLocalStaff());
    }
  }, []);

  useEffect(() => {
    void refreshStaff();

    const handleUpdate = () => {
      setStaffList(staffApi.getLocalStaff());
    };
    window.addEventListener("hg:staff-updated", handleUpdate);
    return () => window.removeEventListener("hg:staff-updated", handleUpdate);
  }, [refreshStaff]);

  function handleOpenAdd() {
    setSelectedStaff(null);
    setModalMode("create");
    setModalOpen(true);
  }

  function handleOpenView(staff: StaffMember) {
    setSelectedStaff(staff);
    setModalMode("view");
    setModalOpen(true);
  }

  function handleOpenEdit(staff: StaffMember) {
    setSelectedStaff(staff);
    setModalMode("edit");
    setModalOpen(true);
  }

  async function handleDelete(staff: StaffMember) {
    if (!window.confirm(`Are you sure you want to remove ${staff.name}?`)) {
      return;
    }
    try {
      await staffApi.delete(staff.id);
      success("Staff Removed", `${staff.name} has been removed.`);
      await refreshStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete staff";
      toastError("Error", msg);
    }
  }

  const columns: Column<StaffMember>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (s) => (
        <div className="flex items-center gap-3">
          {s.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.avatarUrl}
              alt={s.name}
              className="h-9 w-9 rounded-full border border-neutral-200 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand-ink">
              {s.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
          )}
          <span>
            <span className="block font-semibold text-neutral-900">{s.name}</span>
            <span className="block text-xs text-neutral-500">{s.phone}</span>
          </span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (s) => <span className="font-medium text-neutral-800">{s.role}</span>,
    },
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
      render: (s) => (
        <Badge
          tone={s.status === "ACTIVE" ? "green" : s.status === "ON LEAVE" ? "amber" : "neutral"}
        >
          {s.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (s) => (
        <div className="flex items-center gap-1.5">
          {/* View icon (GET) */}
          <button
            type="button"
            title="View Details"
            onClick={() => handleOpenView(s)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          >
            <Eye className="h-4 w-4" />
          </button>

          {/* Edit icon (PUT / PATCH) */}
          <button
            type="button"
            title="Edit Staff"
            onClick={() => handleOpenEdit(s)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          >
            <Pencil className="h-4 w-4" />
          </button>

          {/* Delete icon (DELETE) */}
          <button
            type="button"
            title="Remove Staff"
            onClick={() => handleDelete(s)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardShell title="Staff" subtitle="Hostel Ghar / Staff — roles, shifts and contact.">
      <Protected permission="MANAGE_STAFF" redirectTo="/dashboard">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">{staffList.length} staff members</p>
          <Button onClick={handleOpenAdd}>
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        </div>

        <DataTable<StaffMember>
          columns={columns}
          rows={staffList}
          rowKey={(s) => s.id}
          searchableKeys={["name", "role", "phone"]}
          searchPlaceholder="Search staff…"
          mobileCard={(s) => (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {s.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.avatarUrl}
                      alt={s.name}
                      className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand-ink">
                      {s.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-neutral-900">{s.name}</span>
                    <span className="block text-xs text-neutral-500">
                      {s.role} · {s.shift} shift · {s.phone}
                    </span>
                  </span>
                </div>
                <Badge
                  tone={
                    s.status === "ACTIVE" ? "green" : s.status === "ON LEAVE" ? "amber" : "neutral"
                  }
                >
                  {s.status}
                </Badge>
              </div>

              {/* Mobile CRUD Actions */}
              <div className="flex items-center justify-end gap-1.5 border-t border-neutral-100 pt-2">
                <button
                  type="button"
                  title="View Details"
                  onClick={() => handleOpenView(s)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-neutral-600 hover:bg-neutral-50"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Edit Staff"
                  onClick={() => handleOpenEdit(s)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-neutral-600 hover:bg-neutral-50"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Remove Staff"
                  onClick={() => handleDelete(s)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        />

        <Card className="mt-4 p-4 text-[13px] text-neutral-500">
          Attendance and payroll unlock with staff management on PRO and above.
        </Card>

        {/* Clean Staff Form Modal */}
        <StaffModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          staffList={staffList}
          onStaffMutated={refreshStaff}
          mode={modalMode}
          targetStaff={selectedStaff}
        />
      </Protected>
    </DashboardShell>
  );
}
