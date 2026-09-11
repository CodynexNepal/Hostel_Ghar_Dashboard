"use client";
import { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { MOCK_PAYMENTS } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { Wallet } from "lucide-react";

export default function ResidentPaymentsPage() {
  const { success } = useToast();
  const [method, setMethod] = useState("ESEWA");
  return (
    <DashboardShell title="My Payments" subtitle="Pay rent and track dues.">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-brand-ink p-6 text-white lg:col-span-1">
          <p className="text-[13px] text-neutral-400">Due · October 2026</p>
          <p className="mt-1 text-3xl font-bold text-brand">{formatCurrency(12000)}</p>
          <p className="mt-1 text-[13px] text-neutral-400">Due by 10 Oct · Room 201</p>
          <div
            className="mt-4 grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Payment method"
          >
            {["ESEWA", "KHALTI", "BANK"].map((m) => (
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
            onClick={() => success("Payment initiated", `${method} · Rs. 12,000`)}
          >
            <Wallet className="h-4 w-4" /> Pay {formatCurrency(12000)}
          </Button>
        </Card>
        <Card className="lg:col-span-2">
          <div className="border-b border-surface-border px-5 py-4">
            <p className="text-[15px] font-semibold">Payment history</p>
            <p className="text-[13px] text-neutral-500">Receipts for every transaction</p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {MOCK_PAYMENTS.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {p.month} · {formatCurrency(p.amount)}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {formatDate(p.date)} · {p.method}
                  </span>
                </span>
                <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => success("Receipt downloaded", p.month)}
                >
                  Receipt
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </DashboardShell>
  );
}
