"use client";
import { useMemo, useState } from "react";
import { formatCompact } from "@/lib/analytics";

const W = 720; const H = 240;
const PAD = { l: 44, r: 12, t: 14, b: 30 };

export function ChartShell({ title, subtitle, filters, onExport, children, footer }: {
  title: string; subtitle?: string; filters?: React.ReactNode;
  onExport?: () => void; children: React.ReactNode; footer?: React.ReactNode;
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
            <button onClick={onExport} aria-label={`Export ${title} as CSV`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-surface-border px-2.5 text-xs font-semibold text-neutral-700 transition hover:border-brand-ink hover:text-black">
              CSV
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="border-t border-surface-border bg-surface-muted/50 px-5 py-3 text-[13px] text-neutral-600">{footer}</div>}
    </section>
  );
}

function scales(count: number, max: number) {
  const x = (i: number) => PAD.l + (i / Math.max(1, count - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / Math.max(1, max)) * (H - PAD.t - PAD.b);
  return { x, y };
}
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
export function AreaLines({ series, labels, formatY }: {
  series: { color: string; values: number[]; dashed?: boolean; fill?: boolean }[];
  labels: string[]; formatY?: (v: number) => string;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const { x, y } = useMemo(() => scales(labels.length, max * 1.12), [labels.length, max]);
  const [idx, setIdx] = useState<number | null>(null);
  const ticks = useMemo(() => [0, 0.33, 0.66, 1].map((f) => Math.round(max * 1.12 * f)), [max]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Trend chart" onMouseLeave={() => setIdx(null)}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} stroke="#EDEDEB" strokeWidth="1" />
          <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#8A8A86">{formatCompact(t)}</text>
        </g>
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
        const line = smooth(pts);
        return (
          <g key={si}>
            {s.fill !== false && <path d={`${line} L ${pts[pts.length-1].x} ${H-PAD.b} L ${pts[0].x} ${H-PAD.b} Z`} fill={s.color} opacity={si === 0 ? 0.16 : 0.07} />}
            <path d={line} fill="none" stroke={s.color} strokeWidth={si === 0 ? 2.8 : 2} strokeLinecap="round" strokeDasharray={s.dashed ? "6 4" : ""} />
          </g>
        );
      })}
      {labels.map((l, i) => {
        const step = Math.max(1, Math.ceil(labels.length / 8));
        return (i % step === 0 || i === labels.length - 1) ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#8A8A86">{l}</text>
        ) : null;
      })}
      {labels.map((_, i) => (
        <rect key={i} x={x(i) - W / labels.length / 2} y={0} width={W / labels.length} height={H} fill="transparent"
          onMouseEnter={() => setIdx(i)} onFocus={() => setIdx(i)} tabIndex={0}>
          <title>{`${labels[i]}: ${series.map((s) => formatY ? formatY(s.values[i]) : s.values[i]).join(" · ")}`}</title>
        </rect>
      ))}
      {idx !== null && (
        <g pointerEvents="none">
          <line x1={x(idx)} y1={0} x2={x(idx)} y2={H - PAD.b} stroke="#010101" strokeOpacity="0.2" strokeDasharray="3 3" />
          {series.map((s, si) => <circle key={si} cx={x(idx)} cy={y(s.values[idx])} r="4.5" fill="#010101" stroke="#C3FF7D" strokeWidth="2.5" />)}
          <foreignObject x={Math.min(Math.max(x(idx) - 90, 2), 538)} y={6} width="180" height="84">
            <div className="rounded-lg border border-neutral-800 bg-[#010101] px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-pop">
              <p className="font-bold text-brand">{labels[idx]}</p>
              {series.map((s, si) => (
                <p key={si} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {formatY ? formatY(s.values[idx]) : s.values[idx]}
                </p>
              ))}
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
}
