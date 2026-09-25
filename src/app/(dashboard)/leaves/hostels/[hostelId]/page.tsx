"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

type LeavePagination = {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type LeaveRequestRow = LeaveRequest & {
  residentName: string;
  residentEmail: string;
  residentPhone: string;
  roomLabel: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
};

function cleanEmail(value?: string): string {
  const raw = value ?? "";
  const markdownMatch = raw.match(/\[([^\]]+)\]/);
  const email = markdownMatch?.[1] ?? raw;
  return email.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}

function normalizeRequest(raw: LeaveRequest): LeaveRequestRow {
  const user = raw.resident?.user;
  const residentName =
    raw.userName ??
    raw.user?.name ??
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ??
    "Resident";
  const roomNumber = raw.resident?.roomNumber;
  const bedNumber = raw.resident?.bedNumber;

  return {
    ...raw,
    residentName: residentName || "Resident",
    residentEmail: cleanEmail(user?.email),
    residentPhone: user?.phone ?? "",
    roomLabel:
      roomNumber || bedNumber
        ? `Room ${roomNumber || "-"} - Bed ${bedNumber || "-"}`
        : "Room not assigned",
    leaveTypeName: raw.leaveType?.name ?? raw.type ?? "Leave",
    fromDate: raw.fromDate ?? raw.startDate ?? "",
    toDate: raw.toDate ?? raw.endDate ?? "",
  };
}

function readPagination(
  payload: unknown,
  fallbackPage: number,
  fallbackLimit: number,
  itemCount: number
): LeavePagination {
  const root = (payload ?? {}) as { pagination?: Partial<LeavePagination> };
  const totalItems = Number(root.pagination?.totalItems ?? itemCount);
  const currentPage = Number(root.pagination?.currentPage ?? fallbackPage);
  const totalPages = Math.max(1, Number(root.pagination?.totalPages ?? 1));
  const itemsPerPage = Number(root.pagination?.itemsPerPage ?? fallbackLimit);

  return {
    totalItems,
    currentPage,
    totalPages,
    itemsPerPage,
    hasNextPage: Boolean(root.pagination?.hasNextPage ?? currentPage < totalPages),
    hasPrevPage: Boolean(root.pagination?.hasPrevPage ?? currentPage > 1),
  };
}

function dayCount(fromDate: string, toDate: string): number | null {
  if (!fromDate || !toDate) return null;
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const diff = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  return Number.isFinite(diff) && diff > 0 ? diff : null;
}

export default function HostelLeaveRequestsPage() {
  const params = useParams<{ hostelId: string }>();
  const hostelId = params.hostelId;
  const { success, error: toastError } = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const {
    data,
    error,
    isLoading,
    isRefetching,
    refetch,
  } = useApi(async () => {
    const res = await hostelGhar.leaves.hostelRequests(hostelId, {
      page,
      limit,
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    const requests = toPaginated<LeaveRequest>(res.data).items.map(normalizeRequest);
    return {
      requests,
      pagination: readPagination(res.data, page, limit, requests.length),
    };
  }, [hostelId, statusFilter, page, limit]);

  const { mutate: setStatus, isPending: isUpdating } = useMutation(
    ({ id, status }: { id: string; status: string }) =>
      hostelGhar.leaves.updateRequestStatus(id, { status })
  );

  const requests = data?.requests ?? [];
  const pagination =
    data?.pagination ??
    ({
      totalItems: requests.length,
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

  async function updateStatus(requestId: string, status: "APPROVED" | "REJECTED") {
    const result = await setStatus({ id: requestId, status });
    if (result) {
      success(`Leave ${status.toLowerCase()}`, "The request has been updated.");
      refetch();
    } else {
      toastError("Couldn't update leave", "Try again in a moment.");
    }
  }

  return (
    <DashboardShell title="Leave Requests" subtitle="Review resident leave requests">
      <Protected permission="VIEW_RESIDENTS">
        <Card>
          <CardHeader
            title="Leave Requests"
            subtitle="Resident leave details and approval status"
            action={
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
                {(["", "PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
                  <button
                    key={status || "all"}
                    onClick={() => {
                      setStatusFilter(status);
                      setPage(1);
                    }}
                    aria-pressed={statusFilter === status}
                    className={
                      statusFilter === status
                        ? "rounded-full bg-brand-ink px-3 py-1 text-xs font-semibold text-brand"
                        : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600"
                    }
                  >
                    {status || "All"}
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-5">
            {isLoading && (
              <p role="status" className="text-sm text-neutral-500">
                Loading...
              </p>
            )}
            {!isLoading && error && (
              <ErrorState
                title="Couldn't load requests"
                description={error.message}
                onRetry={refetch}
              />
            )}
            {!isLoading && !error && requests.length === 0 && (
              <EmptyState
                title="No leave requests"
                description="Pending requests will appear here."
              />
            )}

            {!isLoading && !error && requests.length > 0 && (
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
                      onChange={(event) => {
                        setLimit(Number(event.target.value));
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

                <ul className="divide-y divide-neutral-100">
                  {requests.map((request) => {
                    const days = dayCount(request.fromDate, request.toDate);
                    return (
                      <li key={request.id} className="py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-neutral-900">
                                  {request.residentName}
                                </p>
                                <Badge tone={statusTone(request.status)}>{request.status}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-neutral-500">
                                {request.roomLabel}
                                {request.residentPhone ? ` - ${request.residentPhone}` : ""}
                                {request.residentEmail ? ` - ${request.residentEmail}` : ""}
                              </p>
                            </div>

                            <div className="grid gap-2 text-sm text-neutral-700 sm:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <p className="text-xs text-neutral-400">Leave type</p>
                                <p className="font-medium">{request.leaveTypeName}</p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-400">Dates</p>
                                <p className="font-medium">
                                  {formatDate(request.fromDate)} to {formatDate(request.toDate)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-400">Duration</p>
                                <p className="font-medium">
                                  {days ? `${days} day${days === 1 ? "" : "s"}` : "-"}
                                  {request.leaveType?.maxDays
                                    ? ` / max ${request.leaveType.maxDays}`
                                    : ""}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-400">Requested</p>
                                <p className="font-medium">{formatDate(request.createdAt)}</p>
                              </div>
                            </div>

                            {request.reason && (
                              <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-neutral-700">
                                {request.reason}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              disabled={isUpdating || request.status !== "PENDING"}
                              onClick={() => updateStatus(request.id, "APPROVED")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={isUpdating || request.status !== "PENDING"}
                              onClick={() => updateStatus(request.id, "REJECTED")}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-surface-border pt-3">
                  <p className="text-xs text-neutral-500">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={!pagination.hasPrevPage || isRefetching}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPage((current) => Math.min(pagination.totalPages, current + 1))
                      }
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
      </Protected>
    </DashboardShell>
  );
}
