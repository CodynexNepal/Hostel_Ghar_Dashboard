"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { MOCK_PAYMENTS } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

export function RecentPayments() {
  return (
    <Card>
      <CardHeader
        title="Recent payments"
        subtitle="Latest rent collections"
        action={
          <Link
            href="/payments"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-800 hover:text-black"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <ul className="divide-y divide-neutral-100">
        {MOCK_PAYMENTS.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-5 py-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-neutral-800"
              aria-hidden
            >
              {p.residentName
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-neutral-900">
                {p.residentName}
              </span>
              <span className="block text-xs text-neutral-500">
                {p.month} · {formatDate(p.date)} · {p.method}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-bold text-neutral-900">
                {formatCurrency(p.amount)}
              </span>
              <Badge tone={statusTone(p.status)} className="mt-0.5">
                {p.status}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
