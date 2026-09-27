"use client";
import { BedDouble, BedSingle, Building2, Clock, LayoutGrid, Percent, PiggyBank, Receipt, Users, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency } from "@/lib/utils";
import type { AnalyticsBase } from "@/lib/analytics";
export function KpiGrid({ base }: { base: AnalyticsBase }) {
  const available = Math.max(0, base.totalBeds - base.occupiedBeds);
  const occ = base.totalBeds > 0 ? Math.round((base.occupiedBeds / base.totalBeds) * 1000) / 10 : 0;
  const net = base.monthlyRevenue - base.monthlyExpenses;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key performance indicators">
      <StatCard icon={Building2} title="Total Hostels" value={String(base.totalHostels)} delta="live" deltaUp hint="properties managed" />
      <StatCard icon={Users} title="Total Residents" value={String(base.totalResidents)} delta="live" deltaUp hint="active now" />
      <StatCard icon={LayoutGrid} title="Total Rooms" value={String(base.totalRooms)} delta="live" hint="in inventory" />
      <StatCard icon={BedDouble} title="Occupied Beds" value={`${base.occupiedBeds} / ${base.totalBeds}`} delta={`${occ}%`} deltaUp={occ >= 50} hint="occupancy" />
      <StatCard icon={BedSingle} title="Available Beds" value={String(available)} delta="live" hint="ready to assign" />
      <StatCard icon={Percent} title="Occupancy Rate" value={`${occ}%`} delta={occ >= 70 ? "healthy" : "needs push"} deltaUp={occ >= 70} hint={occ >= 70 ? "above 70% target" : "below 70% target"} />
      <StatCard icon={Wallet} title="Monthly Revenue" value={formatCurrency(base.monthlyRevenue)} delta="live" deltaUp hint="collected this month" />
      <StatCard icon={Clock} title="Pending Payments" value={formatCurrency(base.pendingAmount)} delta="live" hint="follow-up needed" />
      <StatCard icon={Receipt} title="Monthly Expenses" value={formatCurrency(base.monthlyExpenses)} delta="live" hint="across 8 categories" />
      <StatCard icon={PiggyBank} title="Net Revenue" value={formatCurrency(net)} delta={net >= 0 ? "profit" : "loss"} deltaUp={net >= 0} hint="revenue minus expenses" />
    </div>
  );
}
