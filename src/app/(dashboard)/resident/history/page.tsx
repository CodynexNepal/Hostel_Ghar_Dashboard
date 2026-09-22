"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useMyFees } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";

export default function ResidentHistoryPage() {
  const room = useMyRoomSummary();
  const { data, error, isLoading, retry } = useMyFees();
  const fees = data ?? [];
  return (
    <DashboardShell title="Payment History" subtitle={`GET /resident/fees · ${room.hostelName}`}>
      <Card>
        <div className="border-b border-surface-border px-5 py-4">
          <p className="text-[15px] font-semibold">Receipts</p>
          <p className="text-[13px] text-neutral-500">Every bill on your ledger</p>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : error ? (
          <div className="p-5">
            <ErrorState title="Couldn't load history" description={error.message} onRetry={retry} />
          </div>
        ) : fees.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No history yet"
              description="Paid and pending bills will appear here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {fees.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {p.month ?? "Fee"} · {formatCurrency(p.amount)}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {p.dueDate ? formatDate(p.dueDate) : ""}
                    {p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ""}
                    {p.method ? ` · ${p.method}` : ""}
                  </span>
                </span>
                <Badge tone={statusTone(p.status)}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </DashboardShell>
  );
}
