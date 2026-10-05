"use client";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import type { RevenueTrendPoint } from "@/lib/api-types";

const FALLBACK_MONTHS = [
  { m: "Apr", v: 62 },
  { m: "May", v: 74 },
  { m: "Jun", v: 68 },
  { m: "Jul", v: 82 },
  { m: "Aug", v: 91 },
  { m: "Sep", v: 96 },
];

interface RevenueChartProps {
  /** Live buckets from the owner-dashboard aggregate. */
  points?: RevenueTrendPoint[];
  /** Collection rate (0–100) shown as the delta badge when provided. */
  collectionRate?: number;
}

export function RevenueChart({ points, collectionRate }: RevenueChartProps = {}) {
  const live = Array.isArray(points)
    ? points.filter((p) => p && typeof p === "object").slice(-12)
    : [];
  const hasLive = live.length > 0;
  const bars = hasLive
    ? live.map((p) => ({
        m: String(p.label ?? "—"),
        v: Number.isFinite(p.collected) ? (p.collected as number) : 0,
        billed: Number.isFinite(p.billed) ? (p.billed as number | undefined) : undefined,
        outstanding: Number.isFinite(p.outstanding)
          ? (p.outstanding as number | undefined)
          : undefined,
      }))
    : FALLBACK_MONTHS.map((x) => ({
        m: x.m,
        v: x.v,
        billed: undefined as number | undefined,
        outstanding: undefined as number | undefined,
      }));
  const max = Math.max(1, ...bars.map((x) => Math.max(x.v, x.billed ?? 0)));
  const first = bars[0];
  const best =
    hasLive && bars.length > 1 && first ? bars.reduce((a, b) => (b.v > a.v ? b : a), first) : null;
  const totalCollected = bars.reduce((s, x) => s + x.v, 0);
  const totalBilled = bars.reduce((s, x) => s + (x.billed ?? x.v + (x.outstanding ?? 0)), 0);
  const effectiveRate =
    collectionRate !== undefined && Number.isFinite(collectionRate)
      ? collectionRate
      : totalBilled > 0
        ? Math.round((totalCollected / totalBilled) * 1000) / 10
        : undefined;

  // ——— Single live month: a lone bar looks broken/empty, so render a
  // collection-efficiency view (donut + billed vs collected breakdown). ———
  if (hasLive && bars.length === 1) {
    const only = bars[0];
    if (!only) return null;
    const billed = only.billed ?? only.v + (only.outstanding ?? 0);
    const outstanding = Math.max(0, billed - only.v);
    const rate = billed > 0 ? Math.max(0, Math.min(100, (only.v / billed) * 100)) : 0;
    const displayRate =
      effectiveRate !== undefined && Number.isFinite(effectiveRate)
        ? Math.max(0, Math.min(100, effectiveRate))
        : Math.round(rate * 10) / 10;
    const r = 52;
    const c = 2 * Math.PI * r;
    return (
      <Card>
        <CardHeader
          title="Revenue collection"
          subtitle={`${only.m} · ${formatCurrency(only.v)} of ${formatCurrency(billed)} billed`}
          action={
            <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">
              {displayRate}% collected
            </span>
          }
        />
        <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center">
          <div
            className="flex items-center gap-4"
            role="img"
            aria-label={`${only.m} collection ${displayRate} percent, ${formatCurrency(only.v)} of ${formatCurrency(billed)}`}
          >
            <svg width="120" height="120" viewBox="0 0 120 120">
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
                strokeDashoffset={c - (displayRate / 100) * c}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="66" textAnchor="middle" fontSize="20" fontWeight="800" fill="#010101">
                {displayRate}%
              </text>
            </svg>
            <div className="text-sm">
              <p className="font-bold text-neutral-900">{formatCurrency(only.v)}</p>
              <p className="mt-0.5 text-neutral-500">collected in {only.m}</p>
              <p className="mt-2 inline-block rounded-full bg-brand-muted px-2 py-0.5 text-xs font-bold text-brand-ink">
                {only.m} only
              </p>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-700">Collected</span>
                <span className="font-bold text-neutral-900">{formatCurrency(only.v)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-brand-ink transition-all duration-500"
                  style={{ width: `${displayRate}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                <span>Billed {formatCurrency(billed)}</span>
                <span>Outstanding {formatCurrency(outstanding)}</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-surface-muted px-3 py-2">
                <dt className="text-xs text-neutral-500">Billed</dt>
                <dd className="font-bold text-neutral-900">{formatCurrency(billed)}</dd>
              </div>
              <div className="rounded-lg bg-surface-muted px-3 py-2">
                <dt className="text-xs text-neutral-500">Outstanding</dt>
                <dd className="font-bold text-neutral-900">{formatCurrency(outstanding)}</dd>
              </div>
            </dl>
            <p className="text-xs text-neutral-500">
              Only {only.m} billed so far — the monthly trend appears once more months close.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const delta =
    effectiveRate !== undefined
      ? `${Math.round(effectiveRate * 10) / 10}% collected`
      : hasLive
        ? undefined
        : "+12.5%";
  const subtitle = hasLive
    ? `${formatCurrency(totalCollected)} collected${totalBilled > totalCollected ? ` of ${formatCurrency(totalBilled)} billed` : ""} · ${bars.length} month${bars.length === 1 ? "" : "s"}${
        best ? ` · ${best.m} best at ${formatCurrency(best.v)}` : ""
      }`
    : "Last 6 months · Sep at 96%";
  return (
    <Card>
      <CardHeader
        title="Revenue collection"
        subtitle={subtitle}
        action={
          delta ? (
            <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">
              {delta}
            </span>
          ) : undefined
        }
      />
      <div className="px-5 pb-2 pt-4">
        <div
          className="flex h-44 min-w-0 items-end gap-2 sm:gap-3"
          role="img"
          aria-label={
            hasLive
              ? `Revenue bar chart, ${bars.length} months, ${best?.m} highest`
              : "Revenue bar chart, September highest at 96 percent"
          }
        >
          {bars.map((x) => {
            const pct = Math.max(0, Math.min(100, (x.v / max) * 100));
            const billedPct =
              x.billed !== undefined && x.billed > 0
                ? Math.max(0, Math.min(100, (x.billed / max) * 100))
                : undefined;
            return (
              <div key={x.m} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex min-h-0 w-full flex-1 items-end rounded-md bg-neutral-100">
                  <div
                    className="relative w-full rounded-md bg-neutral-200"
                    style={{ height: `${billedPct ?? pct}%` }}
                    title={
                      hasLive
                        ? `${x.m}: ${formatCurrency(x.v)}${
                            x.billed !== undefined
                              ? ` of ${formatCurrency(x.billed)} billed`
                              : x.outstanding !== undefined
                                ? ` · ${formatCurrency(x.outstanding)} outstanding`
                                : ""
                          }`
                        : `${x.m}: ${x.v}%`
                    }
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-md bg-brand-ink transition-all duration-500"
                      style={{
                        height:
                          billedPct && x.billed
                            ? `${(x.v / Math.max(1, x.billed)) * 100}%`
                            : "100%",
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-neutral-500">{x.m}</span>
              </div>
            );
          })}
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
