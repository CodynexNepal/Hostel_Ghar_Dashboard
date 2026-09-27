"use client";
import { useMemo, useState } from "react";
import { formatCompact } from "@/lib/analytics";
const W = 720; const H = 240;
const PAD = { l: 44, r: 12, t: 16, b: 30 };
function sy(count: number, max: number) {
  const x = (i: number) => PAD.l + (i / Math.max(1, count - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / Math.max(1, max)) * (H - PAD.t - PAD.b);
  return { x, y };
}
export function GroupBars({ groups, labels, formatY }: {
  groups: { color: string; label: string; values: number[] }[];
  labels: string[]; formatY?: (v: number) => string;
}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const { y } = useMemo(() => sy(labels.length, max * 1.15), [labels.length, max]);
  const [idx, setIdx] = useState<number | null>(null);
  const n = groups.length;
  const slot = (W - PAD.l - PAD.r) / Math.max(1, labels.length);
  const bw = Math.min(24, (slot * 0.62) / Math.max(1, n));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grouped bar chart" onMouseLeave={() => setIdx(null)}>
      {[0, 0.5, 1].map((f) => {
        const t = Math.round(max * 1.15 * f);
        return (<g key={f}><line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} stroke="#EDEDEB" />
        <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#8A8A86">{formatCompact(t)}</text></g>);
      })}
      {labels.map((l, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        return (
          <g key={i} onMouseEnter={() => setIdx(i)} opacity={idx === null || idx === i ? 1 : 0.45}>
            {groups.map((g, gi) => {
              const bx = cx + (gi - (n - 1) / 2) * (bw + 5) - bw / 2;
              const h = Math.max(3, H - PAD.b - y(g.values[i]));
              return (
                <g key={gi}>
                  <rect x={bx} y={y(g.values[i])} width={bw} height={h} rx="5" fill={g.color}>
                    <title>{`${l} · ${g.label}: ${formatY ? formatY(g.values[i]) : g.values[i]}`}</title>
                  </rect>
                  {idx === i && (<text x={bx + bw / 2} y={y(g.values[i]) - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#010101">{formatY ? formatY(g.values[i]) : g.values[i]}</text>)}
                </g>
              );
            })}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#8A8A86">{l.length > 14 ? l.slice(0, 13) + "…" : l}</text>
          </g>
        );
      })}
    </svg>
  );
}
