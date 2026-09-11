"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { RevenueChart, OccupancyDonut } from "@/components/dashboard/Charts";

export default function AnalyticsPage() {
  return (
    <DashboardShell title="Analytics" subtitle="Hostel Ghar / Analytics — trends and insights.">
      <Protected permission="VIEW_ANALYTICS" redirectTo="/dashboard">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <OccupancyDonut occupied={58} total={72} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Collection rate", "96%", "Sep · +3 pts"],
            ["Avg. stay", "8.4 mo", "retention healthy"],
            ["Vacancy loss", "Rs. 48,000", "14 empty beds"],
          ].map(([t, v, h]) => (
            <Card key={t} className="p-5">
              <p className="text-[13px] text-neutral-500">{t}</p>
              <p className="mt-1 text-2xl font-bold">{v}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{h}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-4">
          <CardHeader title="Method split" subtitle="How residents paid in September" />
          <div className="space-y-3 p-5">
            {[
              ["eSewa", 42],
              ["Cash", 28],
              ["Bank", 18],
              ["Khalti", 12],
            ].map(([m, p]) => (
              <div key={m as string}>
                <div className="flex justify-between text-[13px]">
                  <span className="font-medium">{m}</span>
                  <span className="font-bold">{p}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-brand-ink" style={{ width: `${p}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Protected>
    </DashboardShell>
  );
}
