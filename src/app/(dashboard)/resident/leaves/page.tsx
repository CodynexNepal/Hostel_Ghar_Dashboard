"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { useApi, useMutation } from "@/hooks/useApi";
import { hostelGhar, toPaginated } from "@/lib/hostelGhar";
import type { LeaveRequest } from "@/lib/api-types";
import { formatDate } from "@/lib/utils";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useHostelLeaveTypes } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";

type LeavePagination = {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type LeaveListState = {
  items: LeaveRequest[];
  pagination: LeavePagination;
};

function normalizeLeave(raw: LeaveRequest): LeaveRequest {
  return {
    ...raw,
    type: raw.type ?? raw.leaveType?.name,
    fromDate: raw.fromDate ?? raw.startDate ?? "",
    toDate: raw.toDate ?? raw.endDate ?? "",
    remarks: raw.remarks ?? raw.reason,
  };
}

function readLeaveListState(
  payload: unknown,
  items: LeaveRequest[],
  fallbackPage: number,
  fallbackLimit: number
): LeaveListState {
  const root = (payload ?? {}) as {
    pagination?: Partial<LeavePagination>;
  };
  const totalItems = Number(root.pagination?.totalItems ?? items.length);
  const currentPage = Number(root.pagination?.currentPage ?? fallbackPage);
  const totalPages = Math.max(1, Number(root.pagination?.totalPages ?? 1));
  const itemsPerPage = Number(root.pagination?.itemsPerPage ?? fallbackLimit);

  return {
    items,
    pagination: {
      totalItems,
      currentPage,
      totalPages,
      itemsPerPage,
      hasNextPage: Boolean(root.pagination?.hasNextPage ?? currentPage < totalPages),
      hasPrevPage: Boolean(root.pagination?.hasPrevPage ?? currentPage > 1),
    },
  };
}

export default function ResidentLeavesPage() {
  const { success, error: toastError } = useToast();
  const room = useMyRoomSummary();
  const policies = useHostelLeaveTypes(room.hostelId);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const {
    data: leaveState,
    error,
    isLoading,
    isRefetching,
    refetch,
  } = useApi<LeaveListState>(async () => {
    const res = await hostelGhar.resident.leaves({ page, limit });
    const items = toPaginated<LeaveRequest>(res.data).items.map(normalizeLeave);
    return readLeaveListState(res.data, items, page, limit);
  }, [page, limit]);

  const { mutate: applyLeave, isPending: isApplying } = useMutation(
    (payload: Parameters<typeof hostelGhar.resident.applyLeave>[0]) =>
      hostelGhar.resident.applyLeave(payload)
  );

  const leaves = leaveState?.items ?? [];
  const pagination =
    leaveState?.pagination ??
    ({
      totalItems: leaves.length,
      currentPage: page,
      totalPages: 1,
      itemsPerPage: limit,
      hasNextPage: false,
      hasPrevPage: page > 1,
    } satisfies LeavePagination);
  const rangeStart =
    pagination.totalItems === 0 ? 0 : (pagination.currentPage - 1) * pagination.itemsPerPage + 1;
  const rangeEnd = Math.min(
    pagination.totalItems,
    pagination.currentPage * pagination.itemsPerPage
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate || !toDate) {
      toastError("Missing dates", "Pick a from and to date.");
      return;
    }
    // Backend whitelist: { fromDate, toDate, remarks?, reason?, leaveTypeId? }.
    // Never send `type`; backend rejects it with "property type should not exist".
    const result = await applyLeave({
      fromDate,
      toDate,
      remarks,
      reason,
      ...(leaveTypeId ? { leaveTypeId } : {}),
    });
    if (result) {
      success("Leave requested", `${fromDate} to ${toDate}`);
      setRemarks("");
      setReason("");
      setFromDate("");
      setToDate("");
      setLeaveTypeId("");
      if (page === 1) refetch();
      else setPage(1);
    } else {
      toastError("Couldn't submit leave", "Try again in a moment.");
    }
  }

  return (
    <DashboardShell title="My Leaves" subtitle={room.hostelName}>
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Apply for Leave"
            subtitle={`Policies for ${room.hostelName}`}
          />
          <form className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3" onSubmit={submit}>
            <Input
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
            />
            <Input
              label="To"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
            />
            <div>
              <label
                className="mb-1 block text-[13px] font-medium text-neutral-700"
                htmlFor="leave-type"
              >
                Leave type
              </label>
              <select
                id="leave-type"
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm outline-none focus:border-brand-ink"
              >
                <option value="">General (no policy)</option>
                {(policies.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.maxDays ? ` - max ${p.maxDays}d` : ""}
                  </option>
                ))}
              </select>
              {policies.isLoading && (
                <p className="mt-1 text-xs text-neutral-400">Loading policies...</p>
              )}
            </div>
            <Input
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Family function"
            />
            <div className="sm:col-span-3">
              <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <div className="flex justify-end sm:col-span-3">
              <Button type="submit" loading={isApplying}>
                Apply
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="My Leave Requests"
            subtitle="Your submitted leave requests"
          />
          <div className="p-5">
            {isLoading && <Skeleton className="h-4 w-40" />}
            {!isLoading && error && (
              <ErrorState
                title="Couldn't load leaves"
                description={error.message}
                onRetry={refetch}
              />
            )}
            {!isLoading && !error && leaves.length === 0 && (
              <EmptyState
                title="No leave requests"
                description="Your approved and pending leaves will show here."
              />
            )}

            {!isLoading && !error && leaves.length > 0 && (
              <>
                <div className="mb-3 flex flex-col gap-2 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {rangeStart}-{rangeEnd} of {pagination.totalItems}
                    {isRefetching ? " - refreshing" : ""}
                  </span>
                  <label className="flex items-center gap-2">
                    <span>Rows</span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-9 rounded-md border border-surface-border bg-white px-2 text-sm outline-none focus:border-brand-ink"
                    >
                      {[10, 20, 50].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <ul className="divide-y">
                  {leaves.map((leave) => (
                    <li key={leave.id} className="py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {leave.type ?? leave.leaveType?.name ?? "Leave"}
                          </div>
                          <div className="mt-1 text-sm text-neutral-500">
                            {formatDate(leave.fromDate)} to {formatDate(leave.toDate)}
                          </div>
                          {leave.leaveType && (
                            <div className="mt-1 text-xs text-neutral-500">
                              Max {leave.leaveType.maxDays ?? "-"} days
                              {leave.leaveType.requiresParentApproval
                                ? " - parent approval required"
                                : ""}
                            </div>
                          )}
                          {leave.createdAt && (
                            <div className="mt-1 text-xs text-neutral-400">
                              Requested {formatDate(leave.createdAt)}
                            </div>
                          )}
                          {(leave.remarks || leave.reason) && (
                            <p className="mt-2 text-sm text-neutral-700">
                              {leave.reason ?? leave.remarks}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                          <Badge tone={statusTone(leave.status)}>{leave.status}</Badge>
                          <div className="font-mono text-[11px] text-neutral-400">
                            {leave.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-surface-border pt-3">
                  <p className="text-xs text-neutral-500">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrevPage || isRefetching}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={!pagination.hasNextPage || isRefetching}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
