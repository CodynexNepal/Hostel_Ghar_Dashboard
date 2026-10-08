"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  hostelGhar,
  normalizeAdminSummary,
  normalizeHostelList,
  normalizeResident,
  normalizeResidentFee,
  toPaginated,
  unwrap,
  type AdminSummaryWithCounts,
} from "@/lib/hostelGhar";
import { toApiError, type ApiErrorShape } from "@/lib/axios";
import type { Hostel } from "@/types/hostel";
import type { PaymentStatus } from "@/types/resident";

/** Guard against fanning out to an unbounded number of hostels. */
const MAX_HOSTELS = 100;
const RESIDENT_LIMIT = 500;

/** One resident's current billing cycle, joined to its hostel — a ledger row. */
export interface AdminPaymentRow {
  /** Stable key: resident + billing period. */
  id: string;
  residentId: string;
  residentName: string;
  phone: string;
  email: string;
  hostelId: string;
  hostelName: string;
  roomNumber: string;
  bedNumber: string;
  billingMonth: number | null;
  billingYear: number | null;
  /** Human label for the cycle, e.g. "Sep 2026". */
  billingLabel: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  totalPayable: number;
  dueDate: string | null;
  status: PaymentStatus;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 2026" — falls back to "—" when the backend omits the period. */
function billingLabel(month: number | null, year: number | null): string {
  if (month === null || year === null) return "—";
  const name = MONTHS[month - 1];
  if (!name) return String(year);
  return `${name} ${year}`;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Map a raw resident row to a payment-ledger row, or `null` when the resident
 * has no fee for the current cycle (nothing to show in a payments ledger).
 */
function toPaymentRow(raw: unknown, fallbackHostel?: Hostel): AdminPaymentRow | null {
  const fee = normalizeResidentFee(raw);
  if (!fee) return null;
  const resident = normalizeResident(raw);
  const src = (raw ?? {}) as Record<string, unknown>;
  const hostelObj = (src.hostel ?? src.hostelDetails ?? {}) as Record<string, unknown>;
  const hostelId =
    str(src.hostelId) || str(src.hostel_id) || str(hostelObj.id) || fallbackHostel?.id || "";
  const hostelName =
    str(src.hostelName) ||
    str(src.hostel_name) ||
    str(hostelObj.name) ||
    fallbackHostel?.name ||
    "—";
  return {
    id: `${resident.id}-${fee.billingYear ?? "x"}-${fee.billingMonth ?? "x"}`,
    residentId: resident.id,
    residentName: resident.name,
    phone: resident.phone,
    email: resident.email,
    hostelId,
    hostelName,
    roomNumber: resident.roomNumber,
    bedNumber: resident.bedNumber,
    billingMonth: fee.billingMonth,
    billingYear: fee.billingYear,
    billingLabel: billingLabel(fee.billingMonth, fee.billingYear),
    amount: fee.amount,
    paidAmount: fee.paidAmount,
    dueAmount: fee.dueAmount,
    totalPayable: fee.totalPayable,
    dueDate: fee.dueDate,
    status: fee.status,
  };
}

interface PaymentsState {
  rows: AdminPaymentRow[];
  summary: AdminSummaryWithCounts | null;
  hostels: Hostel[];
  /** Hostels whose resident fetch failed — the rest of the page still works. */
  failedHostelCount: number;
  error: ApiErrorShape | null;
  isLoading: boolean;
}
/**
 * Load the platform-wide resident payment ledger.
 *
 * There is no dedicated GET /admin/payments endpoint, so this follows the
 * super-admin bypass convention used by the residents page:
 *   1. GET /admin/hostels — the hostel roster.
 *   2. GET /hostels/:id/residents for each one (Promise.allSettled, so a single
 *      failing hostel never fails the whole page).
 * The resident payload carries its current fee under `fee`, which
 * `normalizeResidentFee` turns into a ledger row.
 *
 * `GET /analytics/admin/summary` runs alongside for the KPI totals.
 */
export function useAdminPayments() {
  const [state, setState] = useState<PaymentsState>({
    rows: [],
    summary: null,
    hostels: [],
    failedHostelCount: 0,
    error: null,
    isLoading: true,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const [hostelsRes, summaryRes] = await Promise.allSettled([
        hostelGhar.admin.listHostels({ limit: MAX_HOSTELS }),
        hostelGhar.analytics.adminSummary(),
      ]);

      if (hostelsRes.status === "rejected") {
        setState({
          rows: [],
          summary: null,
          hostels: [],
          failedHostelCount: 0,
          error: toApiError(hostelsRes.reason),
          isLoading: false,
        });
        return;
      }

      const hostels = normalizeHostelList(hostelsRes.value.data).slice(0, MAX_HOSTELS);
      const summary =
        summaryRes.status === "fulfilled" ? normalizeAdminSummary(summaryRes.value.data) : null;

      const settled = await Promise.allSettled(
        hostels.map(async (hostel) => {
          const res = await hostelGhar.hostels.residents(hostel.id, { limit: RESIDENT_LIMIT });
          const items = toPaginated<unknown>(unwrap<unknown>(res.data)).items;
          return items
            .map((item) => toPaymentRow(item, hostel))
            .filter((row): row is AdminPaymentRow => row !== null);
        })
      );

      const rows = settled
        .filter((r): r is PromiseFulfilledResult<AdminPaymentRow[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);

      // Guard against duplicate React keys if a resident appears twice.
      const seen = new Set<string>();
      const unique = rows.map((row) => {
        let id = row.id;
        let n = 2;
        while (seen.has(id)) id = `${row.id}-${n++}`;
        seen.add(id);
        return id === row.id ? row : { ...row, id };
      });

      // Newest cycle first, then heaviest outstanding first.
      unique.sort(
        (a, b) =>
          (b.billingYear ?? 0) * 12 +
            (b.billingMonth ?? 0) -
            ((a.billingYear ?? 0) * 12 + (a.billingMonth ?? 0)) || b.dueAmount - a.dueAmount
      );

      setState({
        rows: unique,
        summary,
        hostels,
        failedHostelCount: settled.filter((r) => r.status === "rejected").length,
        error: null,
        isLoading: false,
      });
    } catch (e) {
      setState({
        rows: [],
        summary: null,
        hostels: [],
        failedHostelCount: 0,
        error: toApiError(e),
        isLoading: false,
      });
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return { ...state, refetch: load, retry: load };
}

/** Distinct hostels present in the ledger, for the filter dropdown. */
export function useHostelOptions(hostels: Hostel[], rows: AdminPaymentRow[]) {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const h of hostels) map.set(h.id, h.name);
    for (const r of rows) if (r.hostelId) map.set(r.hostelId, r.hostelName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [hostels, rows]);
}
