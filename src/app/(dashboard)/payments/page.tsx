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
import { MOCK_PAYMENTS, MOCK_RESIDENTS } from "@/lib/mock-data";
import type { Payment } from "@/types/subscription";
import { formatCurrency, formatDate } from "@/lib/utils";
import { paymentSchema, type PaymentFormValues } from "@/schemas/room.schema";
import { useToast } from "@/hooks/useToast";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function PaymentsPage() {
  const { success } = useToast();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({ resolver: yupResolver(paymentSchema) });
  function onSubmit(d: PaymentFormValues) {
    const r = MOCK_RESIDENTS.find((x) => x.id === d.residentId);
    success("Payment recorded", `${r?.name ?? "Resident"} · Rs. ${d.amount}`);
    setOpen(false);
    reset();
  }
  const columns: Column<Payment>[] = [
    {
      key: "residentName",
      header: "Resident",
      sortable: true,
      render: (p) => (
        <span>
          <span className="block font-semibold">{p.residentName}</span>
          <span className="block text-xs text-neutral-500">{p.month}</span>
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
      render: (p) => <Badge tone="gray">{p.method}</Badge>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (p) => <span className="text-neutral-600">{formatDate(p.date)}</span>,
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
            ["Collected (Sep)", formatCurrency(684500), "96% collection"],
            ["Pending", formatCurrency(86500), "7 residents"],
            ["Overdue", formatCurrency(33000), "3 residents"],
          ].map(([t, v, h]) => (
            <Card key={t} className="p-4">
              <p className="text-[13px] text-neutral-500">{t}</p>
              <p className="mt-1 text-xl font-bold">{v}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{h}</p>
            </Card>
          ))}
        </div>
        <div className="mb-4 flex justify-end">
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
                <label htmlFor="pay-resident" className="mb-1.5 block text-[13px] font-medium">
                  Resident *
                </label>
                <select
                  id="pay-resident"
                  {...register("residentId")}
                  className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm"
                >
                  {MOCK_RESIDENTS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · Room {r.roomNumber}
                    </option>
                  ))}
                </select>
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
                <Button type="submit" loading={isSubmitting}>
                  Save payment
                </Button>
              </div>
            </form>
          </Card>
        )}
        <DataTable<Payment>
          columns={columns}
          rows={MOCK_PAYMENTS}
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
      </Protected>
    </DashboardShell>
  );
}
