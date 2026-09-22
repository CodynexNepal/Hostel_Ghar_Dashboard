"use client";
import { useState } from "react";
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

export default function ResidentLeavesPage() {
  const { success, error: toastError } = useToast();
  const room = useMyRoomSummary();
  const policies = useHostelLeaveTypes(room.hostelId);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const {
    data: leaves,
    error,
    isLoading,
    refetch,
  } = useApi(async () => {
    const res = await hostelGhar.resident.leaves();
    return toPaginated<LeaveRequest>(res.data).items;
  }, []);
  const { mutate: applyLeave, isPending: isApplying } = useMutation(
    (payload: Parameters<typeof hostelGhar.resident.applyLeave>[0]) =>
      hostelGhar.resident.applyLeave(payload)
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate || !toDate) {
      toastError("Missing dates", "Pick a from and to date.");
      return;
    }
    const policy = (policies.data ?? []).find((p) => p.id === leaveTypeId);
    const result = await applyLeave({
      fromDate,
      toDate,
      remarks,
      reason,
      ...(leaveTypeId ? { leaveTypeId } : {}),
      ...(policy ? { type: policy.name } : {}),
    });
    if (result) {
      success("Leave requested", `${fromDate} → ${toDate}`);
      setRemarks("");
      setReason("");
      setFromDate("");
      setToDate("");
      setLeaveTypeId("");
      refetch();
    } else {
      toastError("Couldn't submit leave", "Try again in a moment.");
    }
  }
  return (
    <DashboardShell title="My Leaves" subtitle="POST /resident/leaves/apply + GET /resident/leaves">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Apply for Leave"
            subtitle={`Policies: GET /hostels/:id/leave-types (${room.hostelName})`}
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
                    {p.maxDays ? ` · max ${p.maxDays}d` : ""}
                  </option>
                ))}
              </select>
              {policies.isLoading && (
                <p className="mt-1 text-xs text-neutral-400">Loading policies…</p>
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
          <CardHeader title="My Leave Requests" subtitle="GET /resident/leaves" />
          <div className="p-5">
            {isLoading && <Skeleton className="h-4 w-40" />}
            {!isLoading && error && (
              <ErrorState
                title="Couldn't load leaves"
                description={error.message}
                onRetry={refetch}
              />
            )}
            {!isLoading && !error && (!leaves || leaves.length === 0) && (
              <EmptyState
                title="No leave requests"
                description="Your approved and pending leaves will show here."
              />
            )}
            <ul className="divide-y">
              {(leaves ?? []).map((l) => (
                <li key={l.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{l.type ?? "Leave"}</div>
                      <div className="text-sm text-neutral-500">
                        {formatDate(l.fromDate)} — {formatDate(l.toDate)}
                      </div>
                    </div>
                    <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                  </div>
                  {(l.remarks || l.reason) && (
                    <p className="mt-2 text-sm text-neutral-700">{l.reason ?? l.remarks}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
