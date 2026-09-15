"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, statusTone } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { useApi, useMutation } from "@/hooks/useApi";
import { hostelGhar, toPaginated } from "@/lib/hostelGhar";
import type { LeaveRequest } from "@/lib/api-types";
import { formatDate } from "@/lib/utils";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";

export default function ResidentLeavesPage() {
  const { success, error: toastError } = useToast();
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
    const result = await applyLeave({ fromDate, toDate, remarks, reason });
    if (result) {
      success("Leave requested", `${fromDate} → ${toDate}`);
      setRemarks("");
      setReason("");
      setFromDate("");
      setToDate("");
      refetch();
    } else {
      toastError("Couldn't submit leave", "Try again in a moment.");
    }
  }

  return (
    <DashboardShell title="My Leaves" subtitle="Apply and view your leave requests">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Apply for Leave" subtitle="Submit a leave request" />
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
          <CardHeader title="My Leave Requests" subtitle="Recent requests" />
          <div className="p-5">
            {isLoading && (
              <p role="status" className="text-sm text-neutral-500">
                Loading…
              </p>
            )}
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
