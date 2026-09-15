"use client";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useApi, useMutation } from "@/hooks/useApi";
import { hostelGhar, toPaginated } from "@/lib/hostelGhar";
import type { Fee } from "@/lib/api-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Wallet } from "lucide-react";

export default function ResidentPaymentsPage() {
  const { success, error: toastError } = useToast();
  const [method, setMethod] = useState<"ESEWA" | "KHALTI" | "BANK">("ESEWA");
  const {
    data: fees,
    error,
    isLoading,
    refetch,
  } = useApi(async () => {
    const res = await hostelGhar.resident.fees();
    return toPaginated<Fee>(res.data).items;
  }, []);
  const due = useMemo(() => (fees ?? []).find((f) => f.status !== "PAID") ?? null, [fees]);
  const { mutate: payFee, isPending: isPaying } = useMutation(
    ({ feeId, amount }: { feeId: string; amount: number }) =>
      hostelGhar.fees.recordPayment(feeId, { amount, method })
  );
  async function payDue() {
    if (!due) return;
    const result = await payFee({ feeId: due.id, amount: due.amount });
    if (result) {
      success("Payment recorded", `${method} · Rs. ${due.amount}`);
      refetch();
    } else {
      toastError("Payment failed", "Try again or pay via a different method.");
    }
  }
  return (
    <DashboardShell title="My Payments" subtitle="Pay rent and track dues.">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-brand-ink p-6 text-white lg:col-span-1">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32 bg-white/20" />
              <Skeleton className="h-9 w-40 bg-white/20" />
              <Skeleton className="h-10 w-full bg-white/10" />
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
          <Button
            className="mt-4 w-full"
            disabled={!due || isPaying}
            loading={isPaying}
            onClick={payDue}
          >
            <Wallet className="h-4 w-4" /> {due ? `Pay ${formatCurrency(due.amount)}` : "No dues"}
          </Button>
        </Card>
        <Card className="lg:col-span-2">
          <div className="border-b border-surface-border px-5 py-4">
            <p className="text-[15px] font-semibold">Payment history</p>
            <p className="text-[13px] text-neutral-500">Receipts for every transaction</p>
          </div>
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-neutral-500" role="status">
              Loading…
            </p>
          ) : error ? (
            <div className="p-5">
              <ErrorState
                title="Couldn't load fees"
                description={error.message}
                onRetry={refetch}
              />
            </div>
          ) : !fees || fees.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No fees yet" description="Your monthly ledger will appear here." />
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
                      {p.dueDate ? formatDate(p.dueDate) : ""} {p.method ? `· ${p.method}` : ""}
                    </span>
                  </span>
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => success("Receipt downloaded", p.month ?? p.id)}
                  >
                    Receipt
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
