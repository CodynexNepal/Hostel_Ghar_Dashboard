/**
 * Analytics engine — owner-scoped aggregates derived from LIVE owner endpoints
 * (summary + dashboard + rooms + residents + fees + expenses lists).
 * No demo fallback: when a source is missing the aggregate reports
 * `hasX=false` and UI renders a live empty-state instead of invented history.
 * Pure + testable generators; CSV helpers keep downloads consistent.
 */
export type RangeKey = "today" | "7d" | "30d" | "3m" | "6m" | "1y";
export type TrendMode = "daily" | "weekly" | "monthly" | "yearly";
export const RANGE_OPTIONS: { key: RangeKey; label: string; points: number }[] = [
  { key: "today", label: "Today", points: 12 },
  { key: "7d", label: "7D", points: 7 },
  { key: "30d", label: "30D", points: 30 },
  { key: "3m", label: "3M", points: 13 },
  { key: "6m", label: "6M", points: 26 },
  { key: "1y", label: "1Y", points: 12 },
];
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function labelFor(index: number, total: number, range: RangeKey, base = new Date()): string {
  if (range === "today") {
    const hour = Math.round((index / Math.max(1, total - 1)) * 14) + 7;
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}${hour >= 12 ? "pm" : "am"}`;
  }
  if (range === "7d" || range === "30d") {
    const d = new Date(base);
    d.setDate(d.getDate() - (total - 1 - index));
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  if (range === "3m" || range === "6m") {
    const d = new Date(base);
    d.setDate(d.getDate() - (total - 1 - index) * 7);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  const d = new Date(base);
  d.setMonth(d.getMonth() - (total - 1 - index));
  return MONTHS[d.getMonth()];
}
export interface AnalyticsBase {
  totalHostels: number;
  totalResidents: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  monthlyRevenue: number;
  pendingAmount: number;
  monthlyExpenses: number;
  /** True when every figure came from the live backend (no demo fallback). */
  isLive?: boolean;
  /**
   * Live monthly buckets from GET /analytics/owner/summary (`revenueTrend`).
   * When present, `revenueSeries()` renders the real collected curve instead
   * of modeled data.
   */
  liveTrend?: { label: string; collected: number; billed?: number }[];
  /**
   * Live fee lifecycle counts from GET /analytics/owner/summary (`feeCounts`).
   * When present, `paymentStatus()` splits the donut by real counts.
   */
  feeCounts?: { paid?: number; pending?: number; partial?: number; overdue?: number };
  /** Live occupancy % (0-100) when the summary endpoint sends it. */
  occupancyRate?: number;
  /** Live collection % (0-100) when the summary endpoint sends it. */
  collectionRate?: number;
  /** Live pending invoice count when the summary endpoint sends it. */
  pendingCount?: number;
  /** Live vacant room count when the summary endpoint sends it. */
  availableRooms?: number;
  // ——— Owner-scoped live collections (no demo fallback) ———
  /** Live rooms of the owner (GET /rooms). Empty when unfetched/failed. */
  rooms?: import("@/types/hostel").Room[];
  /** Live residents of the owner (GET /owner/residents). */
  residents?: import("@/types/resident").Resident[];
  /** Live fee ledger rows used for payment/revenue splits. */
  fees?: import("@/lib/api-types").Fee[];
  /** Live expenses used for the expense breakdown + monthly total. */
  expenses?: import("@/lib/api-types").Expense[];
  /** True when the rooms list was fetched live (even if empty). */
  hasRooms?: boolean;
  /** True when the residents list was fetched live (even if empty). */
  hasResidents?: boolean;
  /** True when a fee ledger (or recentPayments) was fetched live. */
  hasFees?: boolean;
  /** True when the expenses list was fetched live (even if empty). */
  hasExpenses?: boolean;
  /** True when revenueTrend buckets came from a live endpoint. */
  hasRevenueTrend?: boolean;
  /** Owned hostel rows for the per-hostel table (owner dashboard aggregate). */
  hostels?: {
    hostelId: string;
    hostelName?: string;
    hostelType?: string;
    totalActiveResidents?: string | number;
    residentsOnLeaveToday?: string | number;
  }[];
}
export function defaultBase(): AnalyticsBase {
  return {
    totalHostels: 3,
    totalResidents: 138,
    totalRooms: 42,
    totalBeds: 168,
    occupiedBeds: 132,
    monthlyRevenue: 1485000,
    pendingAmount: 214500,
    monthlyExpenses: 862000,
  };
}
/**
 * Owner-scoped empty base — all zeros, no invented platform totals.
 * Analytics for a hostel owner must start from live endpoints only;
 * sections render a live empty-state until their source arrives.
 */
export function emptyBase(): AnalyticsBase {
  return {
    totalHostels: 0,
    totalResidents: 0,
    totalRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    monthlyRevenue: 0,
    pendingAmount: 0,
    monthlyExpenses: 0,
    isLive: false,
    rooms: [],
    residents: [],
    fees: [],
    expenses: [],
    hasRooms: false,
    hasResidents: false,
    hasFees: false,
    hasExpenses: false,
    hasRevenueTrend: false,
    hostels: [],
  };
}
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}
export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
