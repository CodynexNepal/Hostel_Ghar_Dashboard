/**
 * Analytics engine — deterministic seeded demo data anchored to live totals.
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
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function labelFor(index: number, total: number, range: RangeKey, base = new Date()): string {
  if (range === "today") {
    const hour = Math.round((index / Math.max(1, total - 1)) * 14) + 7;
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}${hour >= 12 ? "pm" : "am"}`;
  }
  if (range === "7d" || range === "30d") {
    const d = new Date(base); d.setDate(d.getDate() - (total - 1 - index));
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  if (range === "3m" || range === "6m") {
    const d = new Date(base); d.setDate(d.getDate() - (total - 1 - index) * 7);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  const d = new Date(base); d.setMonth(d.getMonth() - (total - 1 - index));
  return MONTHS[d.getMonth()];
}
export interface AnalyticsBase {
  totalHostels: number; totalResidents: number; totalRooms: number;
  totalBeds: number; occupiedBeds: number; monthlyRevenue: number;
  pendingAmount: number; monthlyExpenses: number;
}
export function defaultBase(): AnalyticsBase {
  return { totalHostels: 3, totalResidents: 138, totalRooms: 42, totalBeds: 168, occupiedBeds: 132, monthlyRevenue: 1485000, pendingAmount: 214500, monthlyExpenses: 862000 };
}
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}
export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
