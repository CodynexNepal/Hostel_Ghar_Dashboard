"use client";
import { formatCompact } from "@/lib/analytics";
const W = 720; const H = 240;
const PAD = { l: 44, r: 12, t: 16, b: 30 };
export function StackedBars({ stacks, labels, formatY }: {
  stacks: { color: string; label: string; values: number[] }[];
  labels: string[]; formatY?: (v: number) => string;
}) {
  const totals = labels.map((_, i) => stacks.reduce((a, s) => a + s.values[i], 0));
  const max = Math.max(1, ...totals);
  const y = (v: number) => PAD.t + (1 - v / Math.max(1, max * 1.12)) * (H - PAD.t - PAD.b);
  const slot = (W - PAD.l - PAD.r) / Math.max(1, labels.length);
  const bw = Math.min(44, slot * 0.52);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Stacked bar chart">
      {[0, 0.5, 1].map((f) => {
        const t = Math.round(max * 1.12 * f);
        return (<g key={f}><line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} stroke="#EDEDEB" />
        <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#8A8A86">{formatCompact(t)}</text></g>);
      })}
      {labels.map((l, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        let acc = 0;
        return (
          <g key={i}>
            {stacks.map((s, si) => {
              const v0 = acc; acc += s.values[i];
              const y1 = y(v0 + s.values[i]); const y0 = y(v0);
              return (<rect key={si} x={cx - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1)} fill={s.color}>
                <title>{`${l} · ${s.label}: ${formatY ? formatY(s.values[i]) : s.values[i]}`}</title></rect>);
            })}
            <text x={cx} y={H - 20} textAnchor="middle" fontSize="10" fill="#8A8A86">{l.length > 12 ? l.slice(0, 11) + "…" : l}</text>
            <text x={cx} y={y(totals[i]) - 6} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#010101">{totals[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
export function HBarList({ rows, formatV, accent = "#010101" }: {
  rows: { label: string; value: number; sub?: string }[]; formatV: (v: number) => string; accent?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-medium text-neutral-700">{r.label}{r.sub && <span className="text-neutral-400"> · {r.sub}</span>}</span>
            <span className="font-bold tabular-nums text-neutral-900">{formatV(r.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100" role="img" aria-label={`${r.label} ${formatV(r.value)}`}>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%`, background: accent }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
