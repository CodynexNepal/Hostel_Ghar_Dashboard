"use client";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hostelGhar, normalizeDashboardPayment, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { Fee, OwnerDashboard } from "@/lib/api-types";

interface Props {
  /**
   * Live rows from the owner-dashboard aggregate (`recentPayments`).
   * When provided the card renders them directly and skips its own fetch —
   * this is the post-/payments-removal path used by the dashboard page.
   */
  payments?: Fee[];
  /** Legacy path: fetch the hostel ledger when no aggregate rows are given. */
  hostelId?: string;
}

function monthYearLabel(p: Fee): string {
  if (p.month && p.month.trim() !== "") return p.month;
  const m = typeof p.billingMonth === "number" ? p.billingMonth : Number(p.billingMonth);
  const y = typeof p.billingYear === "number" ? p.billingYear : Number(p.billingYear);
  if (Number.isFinite(m) && m >= 1 && m <= 12) {
    const short = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][m - 1];
    return Number.isFinite(y) && y > 0 ? `${short} ${y}` : short;
  }
  return "";
}

function rowDate(p: Fee): string {
  // Prefer an explicit due/paid timestamp; billing month/year otherwise.
  const stamp = p.paidAt ?? p.dueDate;
  if (stamp) return formatDate(stamp);
  return monthYearLabel(p);
}

export function RecentPayments({ payments, hostelId }: Props = {}) {
  const [fees, setFees] = useState<Fee[]>(payments ?? []);
  const [isLoading, setIsLoading] = useState(payments === undefined && Boolean(hostelId));

  // Aggregate rows win when the dashboard already fetched them.
  useEffect(() => {
    if (payments !== undefined) {
      setFees(payments);
      setIsLoading(false);
    }
  }, [payments]);

  useEffect(() => {
    if (payments !== undefined) return;
    let cancelled = false;
    async function load() {
      // No aggregate rows — fall back to the dashboard payload, then the ledger.
      try {
        if (!hostelId) {
          const dash = await hostelGhar.owner.dashboard();
          const d = unwrap<OwnerDashboard>(dash.data);
          const rows = (Array.isArray(d?.recentPayments) ? d.recentPayments : []).map((row) =>
            normalizeDashboardPayment(row)
          );
          if (!cancelled) setFees(rows.slice(0, 5));
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
    load();
    return () => {
      cancelled = true;
    };
  }, [hostelId, payments]);

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
          <Link href="/fees" className="font-semibold underline">
            Finance → Fees
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
            href="/fees"
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
                {monthYearLabel(p)}
                {p.roomNumber ? ` · Room ${p.roomNumber}` : ""}
                {rowDate(p) && rowDate(p) !== monthYearLabel(p) ? ` · ${rowDate(p)}` : ""}{" "}
                {p.method ? `· ${p.method}` : ""}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-bold text-neutral-900">
                {formatCurrency(Number(p.totalPayable ?? p.amount) || 0)}
              </span>
              {typeof p.paidAmount === "number" &&
                p.paidAmount > 0 &&
                p.paidAmount < Number(p.totalPayable ?? p.amount) && (
                  <span className="block text-xs text-neutral-500">
                    paid {formatCurrency(p.paidAmount)}
                  </span>
                )}
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
