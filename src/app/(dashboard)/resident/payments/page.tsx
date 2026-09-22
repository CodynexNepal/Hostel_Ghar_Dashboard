"use client";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useMyFees } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";

type PayMethod = "ESEWA" | "KHALTI" | "BANK";

export default function ResidentPaymentsPage() {
  const room = useMyRoomSummary();
  const { data, error, isLoading, retry } = useMyFees();
  const [method, setMethod] = useState<PayMethod>("ESEWA");
  const fees = useMemo(() => data ?? [], [data]);
  const due = useMemo(() => fees.find((f) => f.status !== "PAID") ?? null, [fees]);
  return (
    <DashboardShell title="My Payments" subtitle={`GET /resident/fees · ${room.hostelName}`}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-brand-ink p-6 text-white lg:col-span-1">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32 bg-white/20" />
              <Skeleton className="h-9 w-40 bg-white/20" />
            </div>
          ) : due ? (
            <>
              <p className="text-[13px] text-neutral-400">Due · {due.month ?? "This month"}</p>
              <p className="mt-1 text-3xl font-bold text-brand">{formatCurrency(due.amount)}</p>
              <p className="mt-1 text-[13px] text-neutral-400">
                {due.dueDate ? `Due by ${formatDate(due.dueDate)}` : "Pay before the 10th"}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-neutral-400">Dues</p>
              <p className="mt-1 text-2xl font-bold text-brand">All clear 🎉</p>
              <p className="mt-1 text-[13px] text-neutral-400">No pending fees right now.</p>
            </>
          )}
          <div
            className="mt-4 grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Payment method"
          >
            {(["ESEWA", "KHALTI", "BANK"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={
                  method === m
                    ? "rounded-md bg-brand py-2 text-xs font-bold text-brand-ink"
                    : "rounded-md bg-white/10 py-2 text-xs font-medium text-white"
                }
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-4 rounded-md bg-white/10 px-3 py-2 text-xs text-neutral-200">
            {due
              ? `Show this at the desk to pay ${formatCurrency(due.amount)} via ${method}. Online payment posts from the owner side (PATCH /fees/:id/payment).`
              : "Nothing to pay — receipts live under Payment History."}
          </p>
        </Card>
        <Card className="lg:col-span-2">
          <div className="border-b border-surface-border px-5 py-4">
            <p className="text-[15px] font-semibold">Current dues</p>
            <p className="text-[13px] text-neutral-500">From GET /resident/fees</p>
          </div>
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-neutral-500" role="status">
              Loading…
            </p>
          ) : error ? (
            <div className="p-5">
              <ErrorState title="Couldn't load fees" description={error.message} onRetry={retry} />
            </div>
          ) : fees.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No fees yet" description="Your monthly ledger will appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {fees.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {p.month ?? "Fee"} · {formatCurrency(p.amount)}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {p.dueDate ? formatDate(p.dueDate) : ""}
                      {p.method ? ` · ${p.method}` : ""}
                    </span>
                  </span>
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
