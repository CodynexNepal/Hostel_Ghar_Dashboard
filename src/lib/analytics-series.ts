import { hashSeed, labelFor, mulberry32, RANGE_OPTIONS, type AnalyticsBase, type RangeKey, type TrendMode } from "./analytics";
export interface OccupancyPoint { label: string; occupancyRate: number; occupied: number; available: number; capacity: number; }
export function occupancyTrend(base: AnalyticsBase, range: RangeKey, seed = "occ"): OccupancyPoint[] {
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
    return { label: labelFor(i, opt.points, range), occupancyRate: Math.round(rate * 1000) / 10, occupied, available: cap - occupied, capacity: cap };
  });
}
export interface RoomStatusSlice { key: string; label: string; full: number; partial: number; available: number; }
export function roomOccupancy(seed = "rooms"): RoomStatusSlice[] {
  const rnd = mulberry32(hashSeed(seed));
  return ["Block A", "Block B", "Block C"].map((label, bi) => {
    const total = 12 + Math.round(rnd() * 8);
    const full = Math.round(total * (0.35 + rnd() * 0.2));
    const partial = Math.round(total * (0.3 + rnd() * 0.15));
    return { key: `b${bi}`, label, full, partial, available: Math.max(0, total - full - partial) };
  });
}
export interface GrowthPoint { label: string; joined: number; left: number; net: number; }
export function residentGrowth(range: RangeKey, seed = "growth"): GrowthPoint[] {
  const opt = RANGE_OPTIONS.find((r) => r.key === range) ?? RANGE_OPTIONS[5];
  const rnd = mulberry32(hashSeed(seed + range));
  return Array.from({ length: opt.points }, (_, i) => {
    const joined = Math.max(0, Math.round(2 + Math.sin(i / 2.2) * 2 + rnd() * 5 + (i > opt.points * 0.6 ? 2 : 0)));
    const left = Math.max(0, Math.round(rnd() * 4));
    return { label: labelFor(i, opt.points, range), joined, left, net: joined - left };
  });
}
export interface RevenuePoint { label: string; rent: number; pending: number; other: number; total: number; prevTotal: number; }
const ML = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function revenueSeries(base: AnalyticsBase, mode: TrendMode, seed = "rev"): RevenuePoint[] {
  const count = mode === "daily" ? 30 : mode === "weekly" ? 12 : mode === "monthly" ? 12 : 5;
  const rnd = mulberry32(hashSeed(seed + mode));
  const monthly = Math.max(60000, base.monthlyRevenue || 900000);
  const scale = mode === "daily" ? monthly / 30 : mode === "weekly" ? monthly / 4.3 : mode === "yearly" ? monthly * 12 : monthly;
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const growth = 1 + (i / count) * 0.22 + Math.sin(i / 2.5) * 0.06;
    const rent = Math.round(scale * 0.86 * growth * (0.94 + rnd() * 0.12));
    const other = Math.round(scale * 0.08 * (0.7 + rnd() * 0.7));
    const pending = Math.round(scale * 0.12 * (0.6 + rnd() * 0.9));
    const total = rent + other;
    const label = mode === "daily" ? `${now.getDate() - (count - 1 - i)} ${ML[now.getMonth()]}` : mode === "weekly" ? `W${i + 1}` : mode === "yearly" ? `${now.getFullYear() - (count - 1 - i)}` : ML[(now.getMonth() - (count - 1 - i) + 24) % 12];
    return { label, rent, pending, other, total, prevTotal: Math.round(total * (0.86 + rnd() * 0.08)) };
  });
}
export interface PaymentSlice { key: string; label: string; amount: number; count: number; }
export function paymentStatus(base: AnalyticsBase): PaymentSlice[] {
  const billed = Math.max(1, base.monthlyRevenue + base.pendingAmount);
  const paid = base.monthlyRevenue;
  const pending = Math.round(base.pendingAmount * 0.52);
  const partial = Math.round(base.pendingAmount * 0.27);
  const overdue = Math.max(0, billed - paid - pending - partial);
  const r = Math.max(1, base.totalResidents);
  return [
    { key: "paid", label: "Paid", amount: paid, count: Math.round(r * 0.68) },
    { key: "partial", label: "Partially paid", amount: partial, count: Math.round(r * 0.09) },
    { key: "pending", label: "Pending", amount: pending, count: Math.round(r * 0.15) },
    { key: "overdue", label: "Overdue", amount: overdue, count: Math.max(1, Math.round(r * 0.08)) },
  ];
}
