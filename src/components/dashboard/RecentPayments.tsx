"use client";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hostelGhar, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { Fee, OwnerDashboard } from "@/lib/api-types";

interface Props {
  hostelId?: string;
}

export function RecentPayments({ hostelId }: Props = {}) {
  const [fees, setFees] = useState<Fee[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(hostelId));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Prefer owner dashboard's embedded recentPayments; else hostel ledger.
      try {
        if (!hostelId) {
          const dash = await hostelGhar.owner.dashboard();
          const d = unwrap<OwnerDashboard>(dash.data);
          if (!cancelled) {
            setFees((d?.recentPayments ?? []).slice(0, 5));
          }
          return;
        }
        const res = await hostelGhar.fees.hostelFees(hostelId, { limit: 5 });
        if (!cancelled) setFees(toPaginated<Fee>(res.data).items.slice(0, 5));
      } catch {
        if (!cancelled) setFees([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    if (hostelId !== undefined || true) load();
    return () => {
      cancelled = true;
    };
  }, [hostelId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Recent payments" subtitle="Latest rent collections" />
        <p className="px-5 py-6 text-sm text-neutral-500" role="status">
          Loading payments…
        </p>
      </Card>
    );
  }

  if (fees.length === 0) {
    return (
      <Card>
        <CardHeader title="Recent payments" subtitle="Latest rent collections" />
        <p className="px-5 py-6 text-sm text-neutral-500">
          No payments yet. Record the first payment from{" "}
          <Link href="/payments" className="font-semibold underline">
            Finance → Payments
          </Link>
          .
        </p>
      </Card>
    );
  }

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
        {fees.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-5 py-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-neutral-800"
              aria-hidden
            >
              {(p.residentName ?? "HG")
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-neutral-900">
                {p.residentName ?? "Resident"}
              </span>
              <span className="block text-xs text-neutral-500">
                {p.month ?? ""} {p.dueDate ? `· ${formatDate(p.dueDate)}` : ""}{" "}
                {p.method ? `· ${p.method}` : ""}
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
