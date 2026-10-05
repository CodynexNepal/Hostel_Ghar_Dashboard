"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { useSubscription } from "@/hooks/useSubscription";
import type { SubscriptionRequest, SubscriptionReviewAction } from "@/lib/api-types";
import { formatCurrency, formatDate } from "@/lib/utils";

type QueueStatus = "PENDING" | "ACTIVE" | "REJECTED";

const STATUS_TABS: { id: QueueStatus; label: string }[] = [
  { id: "PENDING", label: "Pending review" },
  { id: "ACTIVE", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
];

/**
 * Admin review queue for subscription upgrades. Owners upload a payment-success
 * screenshot on `/subscription`; nothing changes until an admin here approves
 * it (approve → plan activates, reject → owner keeps their current plan).
 */
export default function AdminSubscriptionsPage() {
  const { success, error: toastError } = useToast();
  const { requests, isLoading, isMutating, error, actionError, loadRequests, reviewRequest } =
    useSubscription();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("PENDING");
  const [reviewTarget, setReviewTarget] = useState<{
    request: SubscriptionRequest;
    action: SubscriptionReviewAction;
  } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    loadRequests(queueStatus).catch(() => undefined);
  }, [loadRequests, queueStatus]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "PENDING").length,
    [requests]
  );

  async function confirmReview() {
    if (!reviewTarget) return;
    const ok = await reviewRequest(
      reviewTarget.request.id,
      reviewTarget.action,
      note.trim() || undefined
    );
    if (ok) {
      success(
        reviewTarget.action === "APPROVE" ? "Subscription approved" : "Request rejected",
        `${reviewTarget.request.ownerName} · ${reviewTarget.request.plan}`
      );
      setReviewTarget(null);
      setNote("");
    } else {
      toastError("Couldn't review request", actionError ?? "Please try again.");
    }
  }

  const columns: Column<SubscriptionRequest>[] = [
    {
      key: "ownerName",
      header: "Owner",
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{r.ownerName}</p>
          {r.ownerEmail && <p className="text-xs text-neutral-500">{r.ownerEmail}</p>}
        </div>
      ),
    },
    {
      key: "hostelName",
      header: "Hostel",
      sortable: true,
      render: (r) => r.hostelName ?? r.hostelId ?? "—",
    },
    {
      key: "plan",
      header: "Requested plan",
      sortable: true,
      render: (r) => <span className="font-medium text-neutral-900">{r.plan ?? "FREE"}</span>,
    },
    { key: "billingCycle", header: "Cycle", render: (r) => r.billingCycle ?? "—" },
    {
      key: "price",
      header: "Amount",
      sortable: true,
      render: (r) => (
        <span className="font-medium text-neutral-900">{formatCurrency(Number(r.price))}</span>
      ),
    },
    {
      key: "paymentMethod",
      header: "Payment",
      render: (r) => (
        <div className="text-[13px]">
          <p className="font-medium text-neutral-800">{r.paymentMethod ?? "—"}</p>
          {r.paymentReference && <p className="text-xs text-neutral-500">{r.paymentReference}</p>}
        </div>
      ),
    },
    {
      key: "proofUrl",
      header: "Proof",
      render: (r) =>
        r.proofUrl ? (
          <a
            href={r.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-brand-ink underline"
          >
            View screenshot
          </a>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: "createdAt",
      header: "Submitted",
      sortable: true,
      render: (r) => (r.createdAt ? formatDate(r.createdAt) : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={statusTone(String(r.status ?? ""))}>{r.status ?? "—"}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) =>
        r.status === "PENDING" ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setNote("");
                setReviewTarget({ request: r, action: "APPROVE" });
              }}
              disabled={isMutating}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNote("");
                setReviewTarget({ request: r, action: "REJECT" });
              }}
              disabled={isMutating}
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-neutral-500">
            {r.reviewedAt ? formatDate(r.reviewedAt) : "Reviewed"}
            {r.reviewNote ? ` · ${r.reviewNote}` : ""}
          </span>
        ),
    },
  ];

  return (
    <DashboardShell
      title="Subscription requests"
      subtitle="Verify payment screenshots and activate owner plans"
    >
      <BackLink href="/admin" label="Platform overview" />
      <Card className="mt-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
              <ClipboardCheck className="h-4 w-4" aria-hidden /> Payment review queue
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Owners upload a payment-success screenshot when upgrading. Approve to activate the
              plan immediately; reject to keep them on their current plan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setQueueStatus(tab.id)}
                aria-pressed={queueStatus === tab.id}
                className={
                  queueStatus === tab.id
                    ? "rounded-md border border-brand-ink bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink"
                    : "rounded-md border border-surface-border bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-surface-muted"
                }
              >
                {tab.label}
                {tab.id === "PENDING" && pendingCount > 0 ? ` (${pendingCount})` : ""}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadRequests(queueStatus)}
              className="shrink-0 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mt-4">
          {isLoading && requests.length === 0 ? (
            <TableSkeleton rows={4} />
          ) : requests.length === 0 ? (
            <div className="rounded-md border border-dashed border-surface-border px-4 py-10 text-center text-sm text-neutral-500">
              No {queueStatus.toLowerCase()} subscription requests.
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={requests}
              rowKey={(r) => r.id}
              pageSize={10}
              searchPlaceholder="Search owner, hostel or plan…"
              searchableKeys={["ownerName", "hostelName", "plan", "status"]}
            />
          )}
        </div>
      </Card>

      <Modal
        open={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        title={
          reviewTarget?.action === "APPROVE"
            ? "Approve subscription payment?"
            : "Reject subscription request?"
        }
        description={
          reviewTarget
            ? `${reviewTarget.request.ownerName} · ${reviewTarget.request.plan} · ${formatCurrency(
                Number(reviewTarget.request.price)
              )}`
            : undefined
        }
      >
        {reviewTarget && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {reviewTarget.action === "APPROVE"
                ? "The requested plan activates immediately and the owner's previous plan expires."
                : "The owner stays on their current plan and can re-submit with a new payment proof."}
            </p>
            {reviewTarget.request.proofUrl && (
              <a
                href={reviewTarget.request.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm font-medium text-brand-ink underline"
              >
                Open payment screenshot
              </a>
            )}
            <div>
              <label
                htmlFor="review-note"
                className="mb-1.5 block text-[13px] font-medium text-neutral-800"
              >
                Note (optional)
              </label>
              <textarea
                id="review-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  reviewTarget.action === "APPROVE"
                    ? "e.g. Payment received in eSewa"
                    : "e.g. Screenshot amount does not match the plan price"
                }
                className="w-full rounded-md border border-surface-border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={isMutating}>
                Cancel
              </Button>
              <Button onClick={confirmReview} loading={isMutating}>
                {reviewTarget.action === "APPROVE" ? "Approve & activate" : "Reject request"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
