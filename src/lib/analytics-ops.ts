import { hashSeed, labelFor, mulberry32, RANGE_OPTIONS, type AnalyticsBase, type RangeKey } from "./analytics";
import { revenueSeries } from "./analytics-series";
export const EXPENSE_CATEGORIES = ["Electricity","Water","Internet","Maintenance","Staff","Food","Supplies","Other"] as const;
export interface ExpenseSlice { category: string; amount: number; share: number; }
export function expensesByCategory(base: AnalyticsBase, monthSeed = "sep"): ExpenseSlice[] {
  const rnd = mulberry32(hashSeed("exp" + monthSeed));
  const total = Math.max(50000, base.monthlyExpenses || 600000);
  const weights = [0.14, 0.07, 0.05, 0.16, 0.28, 0.18, 0.07, 0.05];
  const j = weights.map((w) => w * (0.85 + rnd() * 0.3));
  const sum = j.reduce((a, b) => a + b, 0);
  return EXPENSE_CATEGORIES.map((category, i) => ({ category, amount: Math.round((j[i] / sum) * total), share: Math.round(((j[i] / sum) * 1000)) / 10 })).sort((a, b) => b.amount - a.amount);
}
export interface RevExpPoint { label: string; revenue: number; expenses: number; net: number; }
export function revenueVsExpenses(base: AnalyticsBase, range: RangeKey): RevExpPoint[] {
  const rev = revenueSeries(base, range === "1y" || range === "6m" ? "monthly" : "weekly", "rev-exp");
  const rnd = mulberry32(hashSeed("cost" + range));
  return rev.map((r, i) => {
    const spike = i === Math.floor(rev.length * 0.7) ? 1.28 : 1;
    const expenses = Math.round(base.monthlyExpenses * (r.total / Math.max(1, base.monthlyRevenue || 1)) * 0.92 * spike * (0.94 + rnd() * 0.12));
    return { label: r.label, revenue: r.total, expenses, net: r.total - expenses };
  });
}
export interface CapacityGroup { key: string; label: string; occupied: number; reserved: number; available: number; maintenance: number; }
export function capacityByBuilding(seed = "cap"): CapacityGroup[] {
  const rnd = mulberry32(hashSeed(seed));
  return ["Block A · F1","Block A · F2","Block B · F1","Block B · F2","Block C · F1"].map((label, i) => {
    const cap = 28 + Math.round(rnd() * 14);
    const occupied = Math.round(cap * (0.6 + rnd() * 0.25));
    const reserved = Math.round(cap * (0.04 + rnd() * 0.05));
    const maintenance = i === 4 ? Math.round(cap * 0.14) : Math.round(rnd() * 2);
    return { key: `c${i}`, label, occupied, reserved, available: Math.max(0, cap - occupied - reserved - maintenance), maintenance };
  });
}
export function demographics(seed = "demo") {
  const rnd = mulberry32(hashSeed(seed));
  const female = 38 + Math.round(rnd() * 8);
  return {
    gender: [{ label: "Male", value: 96 - female - 4 }, { label: "Female", value: female }, { label: "Other", value: 4 }],
    age: [{ label: "16–20", value: 34 + Math.round(rnd() * 6) }, { label: "21–25", value: 40 }, { label: "26–30", value: 16 }, { label: "31+", value: 8 }],
    occupation: [{ label: "Students", value: 64 }, { label: "Employees", value: 24 }, { label: "Interns", value: 12 }],
    roomType: [{ label: "Double", value: 44 }, { label: "Triple", value: 31 }, { label: "Single", value: 15 }, { label: "Dorm", value: 10 }],
  };
}
export interface HostelPerf { id: string; name: string; occupancyRate: number; revenue: number; outstanding: number; residents: number; revPerBed: number; }
export function hostelPerformance(base: AnalyticsBase, seed = "perf"): HostelPerf[] {
  const rnd = mulberry32(hashSeed(seed));
  const names = ["Sunrise Boys · Putalisadak","Green Valley Girls · Pokhara","City Nest · Baneshwor","Himalaya Boys · Chitwan"];
  const n = Math.max(2, Math.min(4, base.totalHostels || 3));
  return names.slice(0, n).map((name, i) => {
    const occupancyRate = Math.round((62 + rnd() * 30 - (i === n - 1 ? 18 : 0)) * 10) / 10;
    const residents = Math.max(8, Math.round((base.totalResidents / n) * (0.8 + rnd() * 0.45)));
    const revenue = Math.round((base.monthlyRevenue / n) * (0.75 + rnd() * 0.5));
    const outstanding = Math.round((base.pendingAmount / n) * (0.6 + rnd() * 0.9));
    return { id: `h${i + 1}`, name, occupancyRate, revenue, outstanding, residents, revPerBed: Math.round(revenue / Math.max(1, Math.round(residents / Math.max(0.4, occupancyRate / 100)))) };
  });
}
export interface MaintenancePoint { label: string; opened: number; resolved: number; pending: number; }
export function maintenanceTrend(range: RangeKey): MaintenancePoint[] {
  const opt = RANGE_OPTIONS.find((r) => r.key === range) ?? RANGE_OPTIONS[2];
  const rnd = mulberry32(hashSeed("maint" + range));
  let backlog = 4;
  return Array.from({ length: opt.points }, (_, i) => {
    const opened = Math.max(0, Math.round(1 + rnd() * 4 + (i === Math.floor(opt.points * 0.65) ? 3 : 0)));
    const resolved = Math.max(0, Math.round(opened * (0.6 + rnd() * 0.5)));
    backlog = Math.max(0, backlog + opened - resolved);
    return { label: labelFor(i, opt.points, range), opened, resolved, pending: backlog };
  });
}
export interface MovementPoint { label: string; checkIns: number; checkOuts: number; transfers: number; net: number; }
export function residentMovement(): MovementPoint[] {
  const rnd = mulberry32(hashSeed("move12"));
  return ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov"].map((label, i) => {
    const checkIns = Math.round(4 + rnd() * 9 + (i === 5 ? 6 : 0));
    const checkOuts = Math.round(1 + rnd() * 6);
    const transfers = Math.round(rnd() * 3);
    return { label, checkIns, checkOuts, transfers, net: checkIns - checkOuts };
  });
}
