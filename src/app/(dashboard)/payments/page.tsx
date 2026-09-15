"use client";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { Fee } from "@/lib/api-types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { paymentSchema, type PaymentFormValues } from "@/schemas/room.schema";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useApi, useMutation } from "@/hooks/useApi";
import { hostelGhar, toPaginated } from "@/lib/hostelGhar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

export default function PaymentsPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const hostelId = user?.hostelId;
  const [open, setOpen] = useState(false);
  const [feeFilter, setFeeFilter] = useState("");
  const {
    data: fees,
    error: feesError,
    isLoading: feesLoading,
    refetch: refetchFees,
  } = useApi(async () => {
    if (!hostelId) return [];
    const res = await hostelGhar.fees.hostelFees(hostelId);
    return toPaginated<Fee>(res.data).items;
  }, [hostelId]);
  const rows = useMemo(() => {
    const list = fees ?? [];
    if (!feeFilter) return list;
    return list.filter((f) => f.status === feeFilter);
  }, [fees, feeFilter]);
  const totals = useMemo(() => {
    const list = fees ?? [];
    const collected = list.filter((f) => f.status === "PAID").reduce((s, f) => s + f.amount, 0);
    const pending = list
      .filter((f) => f.status === "PENDING" || f.status === "PARTIAL")
      .reduce((s, f) => s + f.amount, 0);
    const overdue = list.filter((f) => f.status === "OVERDUE").reduce((s, f) => s + f.amount, 0);
    return { collected, pending, overdue };
  }, [fees]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({ resolver: yupResolver(paymentSchema) });
  const { mutate: recordPayment, isPending: isRecording } = useMutation(
    ({ feeId, amount, method }: { feeId: string; amount: number; method: Fee["method"] }) =>
      hostelGhar.fees.recordPayment(feeId, {
        amount,
        method: method as "CASH" | "ESEWA" | "KHALTI" | "BANK",
      })
  );
  async function onSubmit(d: PaymentFormValues) {
    // Map legacy residentId select → feeId. Backend records payment per fee.
    const feeId = d.residentId;
    const result = await recordPayment({
      feeId,
      amount: Number(d.amount),
      method: (d.method as Fee["method"]) ?? "CASH",
    });
    if (result) {
      success("Payment recorded", `Rs. ${d.amount}`);
      setOpen(false);
      reset();
      refetchFees();
    } else {
      toastError("Couldn't record payment", "Check the fee ID, amount and try again.");
    }
  }
  const columns: Column<Fee>[] = [
    {
      key: "residentName",
      header: "Resident",
      sortable: true,
      render: (p) => (
        <span>
          <span className="block font-semibold">{p.residentName ?? "Resident"}</span>
          <span className="block text-xs text-neutral-500">{p.month ?? p.dueDate ?? ""}</span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (p) => <span className="font-bold">{formatCurrency(p.amount)}</span>,
    },
    {
      key: "method",
      header: "Method",
      sortable: true,
      render: (p) => <Badge tone="gray">{p.method ?? "—"}</Badge>,
    },
    {
      key: "dueDate",
      header: "Due",
      sortable: true,
      render: (p) => (
        <span className="text-neutral-600">{p.dueDate ? formatDate(p.dueDate) : "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (p) => <Badge tone={statusTone(p.status)}>{p.status}</Badge>,
    },
  ];
  return (
    <DashboardShell
      title="Payments"
      subtitle="Hostel Ghar / Finance / Payments — collections and dues."
    >
      <Protected permission="MANAGE_PAYMENTS" redirectTo="/dashboard">
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Collected", formatCurrency(totals.collected), `${rows.length} fees loaded`],
            ["Pending", formatCurrency(totals.pending), "needs follow-up"],
            ["Overdue", formatCurrency(totals.overdue), "escalate"],
          ].map(([t, v, h]) => (
            <Card key={t} className="p-4">
              <p className="text-[13px] text-neutral-500">{t}</p>
              <p className="mt-1 text-xl font-bold">{v}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{h}</p>
            </Card>
          ))}
        </div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2" role="group" aria-label="Filter by status">
            {(["", "PENDING", "PAID", "OVERDUE"] as const).map((s) => (
              <button
                key={s || "all"}
                onClick={() => setFeeFilter(s)}
                aria-pressed={feeFilter === s}
                className={
                  feeFilter === s
                    ? "rounded-full bg-brand-ink px-3 py-1 text-xs font-semibold text-brand"
                    : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600"
                }
              >
                {s || "All"}
              </button>
            ))}
          </div>
          <Button onClick={() => setOpen((o) => !o)}>
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        </div>
        {open && (
          <Card className="mb-4 border-brand-ink p-5">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="grid gap-4 sm:grid-cols-4"
              noValidate
            >
              <div>
                <label htmlFor="pay-fee" className="mb-1.5 block text-[13px] font-medium">
                  Fee ID *
                </label>
                <select
                  id="pay-fee"
                  {...register("residentId")}
                  className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
                >
                  <option value="">Select an unpaid fee…</option>
                  {(fees ?? [])
                    .filter((f) => f.status !== "PAID")
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.residentName ?? f.id} · Rs. {f.amount}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-neutral-500">
                  Payments are recorded per fee (PATCH /fees/:id/payment).
                </p>
                {errors.residentId && (
                  <p className="mt-1 text-xs text-red-600">{errors.residentId.message}</p>
                )}
              </div>
              <Input
                label="Amount (Rs.)"
                type="number"
                error={errors.amount?.message}
                {...register("amount")}
                required
              />
              <div>
                <label htmlFor="pay-method" className="mb-1.5 block text-[13px] font-medium">
                  Method *
                </label>
                <select
                  id="pay-method"
                  {...register("method")}
                  className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
                >
                  <option value="CASH">Cash</option>
                  <option value="ESEWA">eSewa</option>
                  <option value="KHALTI">Khalti</option>
                  <option value="BANK">Bank</option>
                </select>
                {errors.method && (
                  <p className="mt-1 text-xs text-red-600">{errors.method.message}</p>
                )}
              </div>
              <Input
                label="Month"
                placeholder="Sep 2026"
                error={errors.month?.message}
                {...register("month")}
                required
              />
              <div className="flex items-end gap-2 sm:col-span-4 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isRecording}>
                  Save payment
                </Button>
              </div>
            </form>
          </Card>
        )}
        {feesLoading ? (
          <TableSkeleton rows={6} />
        ) : feesError ? (
          <ErrorState
            title="Couldn't load payments"
            description={feesError.message}
            onRetry={refetchFees}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={hostelId ? "No fees yet" : "No hostel linked"}
            description={
              hostelId
                ? "Generate the monthly ledger, then record payments here."
                : "Link your account to a hostel to see its ledger."
            }
          />
        ) : (
          <DataTable<Fee>
            columns={columns}
            rows={rows}
            rowKey={(p) => p.id}
            searchableKeys={["residentName", "status", "method"]}
            searchPlaceholder="Search payments…"
            mobileCard={(p) => (
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.residentName}</span>
                  <span className="block text-xs text-neutral-500">
                    {formatCurrency(p.amount)} · {p.method}
                  </span>
                </span>
                <Badge tone={statusTone(p.status)}>{p.status}</Badge>
              </div>
            )}
          />
        )}
      </Protected>
    </DashboardShell>
  );
}
