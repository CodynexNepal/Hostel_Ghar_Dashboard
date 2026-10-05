import type { Expense, Fee } from "./api-types";
import type { Resident } from "@/types/resident";
import type { Room } from "@/types/hostel";

/**
 * Owner-scoped live aggregations (no demo/modeling).
 * Every helper derives ONLY from the owner's own live lists.
 */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : 0;
}

function toDate(v?: string | null): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function feeBilled(f: Fee): number {
  for (const c of [f.totalPayable, f.dueAmount, f.amount, f.paidAmount]) {
    const n = num(c);
    if (n > 0) return n;
  }
  return 0;
}

export function feeCollected(f: Fee): number {
  const p = num(f.paidAmount);
  if (p > 0) {
    const b = feeBilled(f);
    return b > 0 ? Math.min(p, b) : p;
  }
  if (String(f.status ?? "").toUpperCase() === "PAID") return feeBilled(f);
  return 0;
}

export interface TrendBucket {
  label: string;
  billingMonth?: number;
  billingYear?: number;
  collected: number;
  billed?: number;
}

function monthKeyOf(f: Fee): { y: number; m: number } | null {
  const bm = num(f.billingMonth);
  const by = num(f.billingYear);
  if (bm >= 1 && bm <= 12 && by > 0) return { y: by, m: bm };
  const d = toDate(f.paidAt) ?? toDate(f.createdAt) ?? toDate(f.dueDate);
  return d ? { y: d.getFullYear(), m: d.getMonth() + 1 } : null;
}

/** Monthly collected/billed buckets from the owner's real fee ledger. */
export function deriveRevenueTrend(fees: Fee[]): TrendBucket[] {
  const map = new Map<string, TrendBucket & { key: number }>();
  for (const f of fees) {
    const k = monthKeyOf(f);
    if (!k) continue;
    const id = `${k.y}-${k.m}`;
    const cur = map.get(id) ?? {
      label: `${MON[k.m - 1]} ${k.y}`,
      billingMonth: k.m,
      billingYear: k.y,
      collected: 0,
      billed: 0,
      key: k.y * 12 + k.m,
    };
    cur.collected += feeCollected(f);
    cur.billed = (cur.billed ?? 0) + feeBilled(f);
    map.set(id, cur);
  }
  return [...map.values()]
    .sort((a, b) => a.key - b.key)
    .slice(-12)
    .map(({ key: _k, ...rest }) => rest);
}

/** Collected sum of the latest billing month. */
export function monthlyCollected(fees: Fee[]): number {
  const t = deriveRevenueTrend(fees);
  return t.length > 0 ? t[t.length - 1].collected : 0;
}

/** Outstanding across the ledger (billed − collected, floored at 0). */
export function totalPending(fees: Fee[]): number {
  return fees.reduce((s, f) => s + Math.max(0, feeBilled(f) - feeCollected(f)), 0);
}

export function collectionPct(collected: number, billed: number): number | undefined {
  return billed > 0 ? Math.round((collected / billed) * 1000) / 10 : undefined;
}

export function deriveFeeCounts(fees: Fee[]) {
  const c = { paid: 0, pending: 0, partial: 0, overdue: 0 };
  for (const f of fees) {
    const s = String(f.status ?? "").toUpperCase();
    if (s === "PAID") c.paid += 1;
    else if (s === "PARTIAL" || s === "PARTIALLY_PAID" || s === "PARTIALLY-PAID") c.partial += 1;
    else if (s === "OVERDUE") c.overdue += 1;
    else c.pending += 1;
  }
  return c;
}

export function unpaidCount(fees: Fee[]): number {
  return fees.filter((f) => String(f.status ?? "").toUpperCase() !== "PAID").length;
}

export function expenseAmount(e: Expense): number {
  return num(e.amount);
}

export function expenseTotal(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + expenseAmount(e), 0);
}

export interface ExpenseMonth {
  key: number;
  y: number;
  m: number;
  label: string;
  total: number;
}

export function groupExpensesByMonth(expenses: Expense[]): ExpenseMonth[] {
  const map = new Map<string, ExpenseMonth>();
  for (const e of expenses) {
    const d = toDate(e.expenseDate) ?? toDate(e.date) ?? toDate(e.createdAt);
    if (!d) continue;
    const id = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const cur = map.get(id) ?? {
      key: d.getFullYear() * 12 + d.getMonth() + 1,
      y: d.getFullYear(),
      m: d.getMonth() + 1,
      label: `${MON[d.getMonth()]} ${d.getFullYear()}`,
      total: 0,
    };
    cur.total += expenseAmount(e);
    map.set(id, cur);
  }
  return [...map.values()].sort((a, b) => a.key - b.key);
}

export function expenseCategoryLabel(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/_/g, " ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Other";
}

export function roomsTotals(rooms: Room[]) {
  const totalRooms = rooms.length;
  const cap = (r: Room) => Math.max(0, num(r.capacity));
  const occ = (r: Room) => Math.min(cap(r), Math.max(0, num(r.occupied)));
  const totalBeds = rooms.reduce((s, r) => s + cap(r), 0);
  const occupiedBeds = rooms.reduce((s, r) => s + occ(r), 0);
  const availableRooms = rooms.filter((r) => String(r.status).toUpperCase() === "AVAILABLE").length;
  const maintenanceBeds = rooms
    .filter((r) => String(r.status).toUpperCase() === "MAINTENANCE")
    .reduce((s, r) => s + cap(r), 0);
  return { totalRooms, totalBeds, occupiedBeds, availableRooms, maintenanceBeds };
}

export interface JoinMonth {
  label: string;
  joined: number;
}

export function residentJoinsByMonth(residents: Resident[], months = 12): JoinMonth[] {
  const now = new Date();
  const out: JoinMonth[] = [];
  const idx = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    idx.set(`${d.getFullYear()}-${d.getMonth()}`, out.length);
    out.push({ label: `${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, joined: 0 });
  }
  for (const r of residents) {
    const d = toDate(r.joinedDate);
    if (!d) continue;
    const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i !== undefined) out[i].joined += 1;
  }
  return out;
}

export function vacatedCount(residents: Resident[]): number {
  return residents.filter((r) => ["VACATED", "INACTIVE"].includes(String(r.status).toUpperCase()))
    .length;
}

export interface FeeBucket {
  label: string;
  rent: number;
  pending: number;
  other: number;
  total: number;
  prevTotal: number;
}

function feeDay(f: Fee): Date | null {
  return toDate(f.paidAt) ?? toDate(f.createdAt) ?? toDate(f.dueDate);
}

export function bucketFeesByDay(fees: Fee[], days = 30): FeeBucket[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const out: (FeeBucket & { _key: string })[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      label: `${d.getDate()} ${MON[d.getMonth()]}`,
      rent: 0,
      pending: 0,
      other: 0,
      total: 0,
      prevTotal: 0,
      _key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
    };
  });
  const idx = new Map(out.map((b, i) => [b._key, i]));
  for (const f of fees) {
    const d = feeDay(f);
    if (!d) continue;
    const i = idx.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    if (i === undefined) continue;
    const c = feeCollected(f);
    out[i].rent += c;
    out[i].pending += Math.max(0, feeBilled(f) - c);
    out[i].total += c;
  }
  return out.map(({ _key: _k, ...rest }) => rest);
}

export function bucketFeesByWeek(fees: Fee[], weeks = 12): FeeBucket[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - (weeks - 1) * 7);
  const startMs = monday.getTime();
  const out: FeeBucket[] = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i * 7);
    return {
      label: `${d.getDate()} ${MON[d.getMonth()]}`,
      rent: 0,
      pending: 0,
      other: 0,
      total: 0,
      prevTotal: 0,
    };
  });
  for (const f of fees) {
    const d = feeDay(f);
    if (!d || d.getTime() < startMs) continue;
    const w = Math.floor((d.getTime() - startMs) / 604800000);
    if (w < 0 || w >= weeks) continue;
    const c = feeCollected(f);
    out[w].rent += c;
    out[w].pending += Math.max(0, feeBilled(f) - c);
    out[w].total += c;
  }
  return out;
}

export function bucketFeesByMonth(fees: Fee[], yearly = false): FeeBucket[] {
  const acc = new Map<string, FeeBucket & { key: number }>();
  for (const f of fees) {
    const k = monthKeyOf(f);
    if (!k) continue;
    const id = yearly ? `${k.y}` : `${k.y}-${k.m}`;
    const cur = acc.get(id) ?? {
      label: yearly ? `${k.y}` : `${MON[k.m - 1]} ${k.y}`,
      rent: 0,
      pending: 0,
      other: 0,
      total: 0,
      prevTotal: 0,
      key: k.y * 12 + k.m,
    };
    const c = feeCollected(f);
    cur.rent += c;
    cur.pending += Math.max(0, feeBilled(f) - c);
    cur.total += c;
    acc.set(id, cur);
  }
  if (!yearly) {
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const id = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!acc.has(id)) {
        acc.set(id, {
          label: `${MON[d.getMonth()]} ${d.getFullYear()}`,
          rent: 0,
          pending: 0,
          other: 0,
          total: 0,
          prevTotal: 0,
          key: d.getFullYear() * 12 + d.getMonth() + 1,
        });
      }
    }
  }
  return [...acc.values()]
    .sort((a, b) => a.key - b.key)
    .slice(-12)
    .map(({ key: _k, ...rest }) => rest);
}
