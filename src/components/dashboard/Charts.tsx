"use client";
import { Card, CardHeader } from "@/components/ui/Card";

const MONTHS = [
  { m: "Apr", v: 62 },
  { m: "May", v: 74 },
  { m: "Jun", v: 68 },
  { m: "Jul", v: 82 },
  { m: "Aug", v: 91 },
  { m: "Sep", v: 96 },
];

export function RevenueChart() {
  const max = Math.max(...MONTHS.map((x) => x.v));
  return (
    <Card>
      <CardHeader
        title="Revenue collection"
        subtitle="Last 6 months · Sep at 96%"
        action={
          <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">
            +12.5%
          </span>
        }
      />
      <div className="px-5 pb-2 pt-4">
        <div
          className="flex h-44 min-w-0 items-end gap-2 sm:gap-3"
          role="img"
          aria-label="Revenue bar chart, September highest at 96 percent"
        >
          {MONTHS.map((x) => (
            <div key={x.m} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex min-h-0 w-full flex-1 items-end rounded-md bg-neutral-100">
                <div
                  className="w-full rounded-md bg-brand-ink transition-all duration-500"
                  style={{ height: `${(x.v / max) * 100}%` }}
                  title={`${x.m}: ${x.v}%`}
                />
              </div>
              <span className="text-xs font-medium text-neutral-500">{x.m}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function OccupancyDonut({ occupied, total }: { occupied: number; total: number }) {
  const pct = Math.round((occupied / Math.max(1, total)) * 100);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-neutral-500">Occupancy rate</p>
      <div className="mt-2 flex items-center gap-4">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          role="img"
          aria-label={`Occupancy ${pct} percent`}
        >
          <circle cx="60" cy="60" r={r} fill="none" stroke="#eee" strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#010101"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="66" textAnchor="middle" fontSize="20" fontWeight="800" fill="#010101">
            {pct}%
          </text>
        </svg>
        <div className="text-sm">
          <p className="font-bold text-neutral-900">
            {occupied} / {total} beds
          </p>
          <p className="mt-1 text-neutral-500">{total - occupied} beds available</p>
          <p className="mt-2 inline-block rounded-full bg-brand-muted px-2 py-0.5 text-xs font-bold text-brand-ink">
            Healthy
          </p>
        </div>
      </div>
    </Card>
  );
}
