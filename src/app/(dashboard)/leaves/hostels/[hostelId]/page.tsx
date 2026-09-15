"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { useApi, useMutation } from "@/hooks/useApi";
import { hostelGhar, toPaginated } from "@/lib/hostelGhar";
import type { LeaveRequest } from "@/lib/api-types";
import { formatDate } from "@/lib/utils";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Protected } from "@/components/common/Protected";

export default function HostelLeaveRequestsPage() {
  const params = useParams<{ hostelId: string }>();
  const hostelId = params.hostelId;
  const { success, error: toastError } = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const {
    data: requests,
    error,
    isLoading,
    refetch,
  } = useApi(async () => {
    const res = await hostelGhar.leaves.hostelRequests(hostelId, statusFilter || undefined);
    return toPaginated<LeaveRequest>(res.data).items;
  }, [hostelId, statusFilter]);
  const { mutate: setStatus, isPending: isUpdating } = useMutation(
    ({ id, status }: { id: string; status: string }) =>
      hostelGhar.leaves.updateRequestStatus(id, { status })
  );

  async function updateStatus(requestId: string, status: "APPROVED" | "REJECTED") {
    const result = await setStatus({ id: requestId, status });
    if (result) {
      success(`Leave ${status.toLowerCase()}`, requestId);
      refetch();
    } else {
      toastError("Couldn't update leave", "Try again in a moment.");
    }
  }

  return (
    <DashboardShell title="Leave Requests" subtitle={`Hostel ${hostelId}`}>
      <Protected permission="VIEW_RESIDENTS">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Leave Requests"
              subtitle={`Hostel ${hostelId}`}
              action={
                <div className="flex gap-2" role="group" aria-label="Filter by status">
                  {(["", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                    <button
                      key={s || "all"}
                      onClick={() => setStatusFilter(s)}
                      aria-pressed={statusFilter === s}
                      className={
                        statusFilter === s
                          ? "rounded-full bg-brand-ink px-3 py-1 text-xs font-semibold text-brand"
                          : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600"
                      }
                    >
                      {s || "All"}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="p-5">
              {isLoading && (
                <p role="status" className="text-sm text-neutral-500">
                  Loading…
                </p>
              )}
              {!isLoading && error && (
                <ErrorState
                  title="Couldn't load requests"
                  description={error.message}
                  onRetry={refetch}
                />
              )}
              {!isLoading && !error && (!requests || requests.length === 0) && (
                <EmptyState
                  title="No leave requests"
                  description="Pending requests will appear here."
                />
              )}
              <ul className="divide-y">
                {(requests ?? []).map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <div className="font-medium">{r.userName ?? r.user?.name ?? "Resident"}</div>
                      <div className="text-sm text-neutral-500">
                        {formatDate(r.fromDate)} — {formatDate(r.toDate)}
                      </div>
                      {(r.remarks || r.reason) && (
                        <p className="mt-2 text-sm">{r.reason ?? r.remarks}</p>
                      )}
                      <div className="mt-1">
                        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        disabled={isUpdating || r.status !== "PENDING"}
                        onClick={() => updateStatus(r.id, "APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isUpdating || r.status !== "PENDING"}
                        onClick={() => updateStatus(r.id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </Protected>
    </DashboardShell>
  );
}
