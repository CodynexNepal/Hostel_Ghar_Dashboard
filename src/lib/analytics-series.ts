import {
  hashSeed,
  labelFor,
  mulberry32,
  RANGE_OPTIONS,
  type AnalyticsBase,
  type RangeKey,
  type TrendMode,
} from "./analytics";
import type { Fee } from "./api-types";
import { bucketFeesByDay, bucketFeesByMonth, bucketFeesByWeek } from "./analytics-live";
export interface OccupancyPoint {
  label: string;
  occupancyRate: number;
  occupied: number;
  available: number;
  capacity: number;
}
export function occupancyTrend(
  base: AnalyticsBase,
  range: RangeKey,
  seed = "occ"
): OccupancyPoint[] {
  const opt = RANGE_OPTIONS.find((r) => r.key === range) ?? RANGE_OPTIONS[2];
  const rnd = mulberry32(hashSeed(seed + range));
  const cap = Math.max(1, base.totalBeds || 120);
  const anchor = cap > 0 ? base.occupiedBeds / cap : 0.78;
  return Array.from({ length: opt.points }, (_, i) => {
    const wave = Math.sin(i / Math.max(4, opt.points / 3)) * 0.035;
    const noise = (rnd() - 0.5) * 0.05;
    const drift = (i / opt.points) * 0.04;
    const rate = Math.min(0.98, Math.max(0.42, anchor + wave + noise + drift));
    const occupied = Math.round(cap * rate);
    return {
      label: labelFor(i, opt.points, range),
      occupancyRate: Math.round(rate * 1000) / 10,
      occupied,
      available: cap - occupied,
      capacity: cap,
    };
  });
}
export interface RoomStatusSlice {
  key: string;
  label: string;
  full: number;
  partial: number;
  available: number;
}
export function roomOccupancy(seed = "rooms"): RoomStatusSlice[] {
  const rnd = mulberry32(hashSeed(seed));
  return ["Block A", "Block B", "Block C"].map((label, bi) => {
    const total = 12 + Math.round(rnd() * 8);
    const full = Math.round(total * (0.35 + rnd() * 0.2));
    const partial = Math.round(total * (0.3 + rnd() * 0.15));
    return { key: `b${bi}`, label, full, partial, available: Math.max(0, total - full - partial) };
  });
}
export interface GrowthPoint {
  label: string;
  joined: number;
  left: number;
  net: number;
}
export function residentGrowth(range: RangeKey, seed = "growth"): GrowthPoint[] {
  const opt = RANGE_OPTIONS.find((r) => r.key === range) ?? RANGE_OPTIONS[5];
  const rnd = mulberry32(hashSeed(seed + range));
  return Array.from({ length: opt.points }, (_, i) => {
    const joined = Math.max(
      0,
      Math.round(2 + Math.sin(i / 2.2) * 2 + rnd() * 5 + (i > opt.points * 0.6 ? 2 : 0))
    );
    const left = Math.max(0, Math.round(rnd() * 4));
    return { label: labelFor(i, opt.points, range), joined, left, net: joined - left };
  });
}
export interface RevenuePoint {
  label: string;
  rent: number;
  pending: number;
  other: number;
  total: number;
  prevTotal: number;
}
const ML = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/**
 * Revenue series — owner-scoped and live-only.
 * 1. Live `revenueTrend` buckets (monthly/yearly) win when present.
 * 2. Otherwise buckets are derived from the owner's real fee ledger
 *    (`base.fees` / `fees`): last 12 months (honest zeros), last 12 weeks,
 *    or last 30 days.
 * 3. No live source → `[]` so the UI renders a live empty-state.
 * Modeled/"previous period" data is never invented for an owner.
 */
export function revenueSeries(
  base: AnalyticsBase,
  mode: TrendMode,
  seed = "rev",
  liveTrend?: { label: string; collected: number; billed?: number }[],
  fees?: Fee[]
): RevenuePoint[] {
  if (liveTrend && liveTrend.length > 0 && (mode === "monthly" || mode === "yearly")) {
    const buckets = liveTrend.slice(-12);
    const per = (p: { billed?: number; collected: number }) =>
      Math.max(0, Math.round((p.billed ?? p.collected) - p.collected));
    return buckets.map((p) => {
      const pending = per(p);
      const rent = p.collected;
      return { label: p.label, rent, pending, other: 0, total: rent, prevTotal: 0 };
    });
  }
  void seed;
  const list = fees ?? base.fees ?? [];
  if (list.length === 0) {
    if (liveTrend && liveTrend.length > 0) {
      const buckets = liveTrend.slice(-12);
      const per = (p: { billed?: number; collected: number }) =>
        Math.max(0, Math.round((p.billed ?? p.collected) - p.collected));
      return buckets.map((p) => {
        const pending = per(p);
        const rent = p.collected;
        return { label: p.label, rent, pending, other: 0, total: rent, prevTotal: 0 };
      });
    }
    return [];
  }
  if (mode === "daily") return bucketFeesByDay(list);
  if (mode === "weekly") return bucketFeesByWeek(list);
  return bucketFeesByMonth(list, mode === "yearly");
}
export interface PaymentSlice {
  key: string;
  label: string;
  amount: number;
  count: number;
  collected?: number;
}
/**
 * Payment-status split — owner-scoped and live-only.
 * 1. Live fee counts (`feeCounts`) win when the summary provides them.
 * 2. Otherwise derived from the owner's real fee ledger (money follows
 *    billed/collected per status, counts follow ledger rows).
 * 3. No live source → `[]` so the UI renders a live empty-state.
 */
export function paymentStatus(
  base: AnalyticsBase,
  liveCounts?: { paid?: number; pending?: number; partial?: number; overdue?: number },
  fees?: Fee[]
): PaymentSlice[] {
  if (liveCounts) {
    const paidC = Math.max(0, Math.round(liveCounts.paid ?? 0));
    const partialC = Math.max(0, Math.round(liveCounts.partial ?? 0));
    const pendingC = Math.max(0, Math.round(liveCounts.pending ?? 0));
    const overdueC = Math.max(0, Math.round(liveCounts.overdue ?? 0));
    const total = paidC + partialC + pendingC + overdueC;
    if (total > 0) {
      // Amounts follow the money totals proportionally to live fee counts.
      const billed = Math.max(1, base.monthlyRevenue + base.pendingAmount);
      const share = (c: number) => Math.round((billed * c) / total);
      return [
        { key: "paid", label: "Paid", amount: share(paidC), count: paidC },
        { key: "partial", label: "Partially paid", amount: share(partialC), count: partialC },
        { key: "pending", label: "Pending", amount: share(pendingC), count: pendingC },
        { key: "overdue", label: "Overdue", amount: share(overdueC), count: overdueC },
      ];
    }
  }
  const list = fees ?? base.fees ?? [];
  if (list.length > 0) {
    const num = (v: unknown): number => {
      const n = typeof v === "string" ? Number(v) : (v as number);
      return Number.isFinite(n) ? (n as number) : 0;
    };
    const billedOf = (f: Fee): number => {
      for (const c of [f.totalPayable, f.dueAmount, f.amount, f.paidAmount]) {
        const n = num(c);
        if (n > 0) return n;
      }
      return 0;
    };
    const collectedOf = (f: Fee): number => {
      const p = num(f.paidAmount);
      if (p > 0) {
        const b = billedOf(f);
        return b > 0 ? Math.min(p, b) : p;
      }
      return String(f.status ?? "").toUpperCase() === "PAID" ? billedOf(f) : 0;
    };
    const groups: Record<string, { amount: number; collected: number; count: number }> = {
      paid: { amount: 0, collected: 0, count: 0 },
      partial: { amount: 0, collected: 0, count: 0 },
      pending: { amount: 0, collected: 0, count: 0 },
      overdue: { amount: 0, collected: 0, count: 0 },
    };
    for (const f of list) {
      const s = String(f.status ?? "").toUpperCase();
      const key =
        s === "PAID"
          ? "paid"
          : s === "PARTIAL" || s === "PARTIALLY_PAID" || s === "PARTIALLY-PAID"
            ? "partial"
            : s === "OVERDUE"
              ? "overdue"
              : "pending";
      groups[key].amount += billedOf(f);
      groups[key].collected += collectedOf(f);
      groups[key].count += 1;
    }
    return [
      { key: "paid", label: "Paid", ...groups.paid },
      { key: "partial", label: "Partially paid", ...groups.partial },
      { key: "pending", label: "Pending", ...groups.pending },
      { key: "overdue", label: "Overdue", ...groups.overdue },
    ];
  }
  return [];
}
