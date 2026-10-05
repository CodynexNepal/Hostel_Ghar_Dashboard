"use client";
import { useMemo, useState } from "react";
import { formatCompact } from "@/lib/analytics";

const W = 720;
const H = 240;
const PAD = { l: 44, r: 12, t: 14, b: 30 };

export function ChartShell({
  title,
  subtitle,
  filters,
  onExport,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  filters?: React.ReactNode;
  onExport?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-surface-border bg-white shadow-card transition-shadow hover:shadow-pop">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-neutral-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-neutral-500">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters}
          {onExport && (
            <button
              onClick={onExport}
              aria-label={`Export ${title} as CSV`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-surface-border px-2.5 text-xs font-semibold text-neutral-700 transition hover:border-brand-ink hover:text-black"
            >
              CSV
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="border-t border-surface-border bg-surface-muted/50 px-5 py-3 text-[13px] text-neutral-600">
          {footer}
        </div>
      )}
    </section>
  );
}

function scales(count: number, max: number) {
  const x = (i: number) => PAD.l + (i / Math.max(1, count - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / Math.max(1, max)) * (H - PAD.t - PAD.b);
  return { x, y };
}
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const first = pts[0];
  if (!first) return "";
  if (pts.length < 2) return `M ${first.x} ${first.y}`;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)] ?? pts[i] ?? first;
    const p1 = pts[i] ?? first;
    const p2 = pts[i + 1] ?? p1;
    const p3 = pts[Math.min(pts.length - 1, i + 2)] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) continue;
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
export function AreaLines({
  series,
  labels,
  formatY,
}: {
  series: { color: string; values: number[]; dashed?: boolean; fill?: boolean }[];
  labels: string[];
  formatY?: (v: number) => string;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const safeLabels = Array.isArray(labels) ? labels : [];
  const safeSeries = Array.isArray(series)
    ? series.map((s) => ({
        color: s?.color ?? "#010101",
        dashed: s?.dashed,
        fill: s?.fill,
        values: Array.isArray(s?.values)
          ? s.values.map((v) => (Number.isFinite(v) ? (v as number) : 0))
          : [],
      }))
    : [];
  const n = safeLabels.length;
  const normalized = safeSeries.map((s) => ({
    ...s,
    values: Array.from({ length: n }, (_, i) => s.values[i] ?? 0),
  }));
  const max = Math.max(1, ...normalized.flatMap((s) => s.values));
  const { x, y } = useMemo(() => scales(n, max * 1.12), [n, max]);
  const ticks = useMemo(() => [0, 0.33, 0.66, 1].map((f) => Math.round(max * 1.12 * f)), [max]);
  const safeIdx = idx !== null && idx >= 0 && idx < n ? idx : null;
  const hasPoints = n > 0 && safeSeries.length > 0 && safeSeries.some((s) => s.values.length > 0);

  // Empty / mismatched data must never crash the page (was: `pts[0].x`
  // on an empty array → "Cannot read properties of undefined (reading 'x')").
  // Render a harmless placeholder so parent empty-states stay in control.
  if (!hasPoints) {
    return (
      <div
        className="flex h-[240px] w-full items-center justify-center rounded-lg bg-neutral-50 text-[13px] text-neutral-500"
        role="img"
        aria-label="Trend chart — no data yet"
      >
        No trend data yet.
      </div>
    );
  }

  const hoverW = W / Math.max(1, n);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Trend chart"
      onMouseLeave={() => setIdx(null)}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} stroke="#EDEDEB" strokeWidth="1" />
          <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#8A8A86">
            {formatCompact(t)}
          </text>
        </g>
      ))}
      {normalized.map((s, si) => {
        const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
        const line = smooth(pts);
        const first = pts[0];
        const last = pts[pts.length - 1];
        const showFill = s.fill !== false && first && last && line;
        return (
          <g key={si}>
            {showFill && (
              <path
                d={`${line} L ${last.x} ${H - PAD.b} L ${first.x} ${H - PAD.b} Z`}
                fill={s.color}
                opacity={si === 0 ? 0.16 : 0.07}
              />
            )}
            {line ? (
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth={si === 0 ? 2.8 : 2}
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "6 4" : ""}
              />
            ) : null}
          </g>
        );
      })}
      {safeLabels.map((l, i) => {
        const step = Math.max(1, Math.ceil(safeLabels.length / 8));
        return i % step === 0 || i === safeLabels.length - 1 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#8A8A86">
            {l}
          </text>
        ) : null;
      })}
      {safeLabels.map((_, i) => (
        <rect
          key={i}
          x={x(i) - hoverW / 2}
          y={0}
          width={hoverW}
          height={H}
          fill="transparent"
          onMouseEnter={() => setIdx(i)}
          onFocus={() => setIdx(i)}
          tabIndex={0}
        >
          <title>{`${safeLabels[i] ?? ""}: ${normalized.map((s) => (formatY ? formatY(s.values[i] ?? 0) : (s.values[i] ?? 0))).join(" · ")}`}</title>
        </rect>
      ))}
      {safeIdx !== null && (
        <g pointerEvents="none">
          <line
            x1={x(safeIdx)}
            y1={0}
            x2={x(safeIdx)}
            y2={H - PAD.b}
            stroke="#010101"
            strokeOpacity="0.2"
            strokeDasharray="3 3"
          />
          {normalized.map((s, si) => (
            <circle
              key={si}
              cx={x(safeIdx)}
              cy={y(s.values[safeIdx] ?? 0)}
              r="4.5"
              fill="#010101"
              stroke="#C3FF7D"
              strokeWidth="2.5"
            />
          ))}
          <foreignObject
            x={Math.min(Math.max(x(safeIdx) - 90, 2), 538)}
            y={6}
            width="180"
            height="84"
          >
            <div className="rounded-lg border border-neutral-800 bg-[#010101] px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-pop">
              <p className="font-bold text-brand">{safeLabels[safeIdx] ?? ""}</p>
              {normalized.map((s, si) => (
                <p key={si} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {formatY ? formatY(s.values[safeIdx] ?? 0) : (s.values[safeIdx] ?? 0)}
                </p>
              ))}
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
}
