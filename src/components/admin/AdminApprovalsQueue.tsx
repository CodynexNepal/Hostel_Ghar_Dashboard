"use client";

import Link from "next/link";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SubscriptionRequest } from "@/lib/api-types";

export function AdminApprovalsQueue({
  rows,
  total,
  isLoading,
  error,
  onRetry,
}: {
  rows: SubscriptionRequest[];
  total: number | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Pending approvals"
        subtitle={
          total != null
            ? `${total} subscription payment${total === 1 ? "" : "s"} awaiting review`
            : "Subscription payments awaiting review"
        }
        action={
          <Link href="/admin/subscriptions">
            <Button size="sm">Review queue</Button>
          </Link>
        }
      />
      {isLoading ? (
        <div className="space-y-2.5 p-4 sm:p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <ErrorState title="Couldn't load approvals" description={error} onRetry={onRetry} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold text-neutral-900">All caught up</p>
          <p className="mt-0.5 max-w-xs text-xs text-neutral-500">
            No subscription payments waiting. New owner screenshots land here instantly.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-neutral-900">
                  {r.ownerName}
                  <span className="font-normal text-neutral-400"> · {r.hostelName ?? "—"}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                  <Badge tone={statusTone(String(r.plan ?? ""))}>{r.plan}</Badge>
                  <span>{formatCurrency(Number(r.price))}</span>
                  {r.createdAt && <span>{formatDate(r.createdAt)}</span>}
                </span>
              </span>
              {r.proofUrl ? (
                <a
                  href={r.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-surface-border px-2.5 py-1.5 text-xs font-medium text-brand-ink hover:border-brand-ink"
                >
                  Proof <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
              <Link href="/admin/subscriptions">
                <Button size="sm" variant="outline">
                  Review
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
