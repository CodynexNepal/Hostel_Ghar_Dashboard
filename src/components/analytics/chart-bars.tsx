"use client";
import { useMemo, useState } from "react";
import { formatCompact } from "@/lib/analytics";
const W = 720;
const H = 240;
const PAD = { l: 44, r: 12, t: 16, b: 30 };
function sy(count: number, max: number) {
  const x = (i: number) => PAD.l + (i / Math.max(1, count - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / Math.max(1, max)) * (H - PAD.t - PAD.b);
  return { x, y };
}
export function GroupBars({
  groups,
  labels,
  formatY,
}: {
  groups: { color: string; label: string; values: number[] }[];
  labels: string[];
  formatY?: (v: number) => string;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const safeLabels = Array.isArray(labels) ? labels : [];
  const safeGroups = Array.isArray(groups)
    ? groups.map((g) => ({
        color: g?.color ?? "#010101",
        label: g?.label ?? "",
        values: Array.isArray(g?.values)
          ? g.values.map((v) => (Number.isFinite(v) ? (v as number) : 0))
          : [],
      }))
    : [];
  const n = safeLabels.length;
  const normalized = safeGroups.map((g) => ({
    ...g,
    values: Array.from({ length: n }, (_, i) => g.values[i] ?? 0),
  }));
  const max = Math.max(1, ...normalized.flatMap((g) => g.values));
  const { y } = useMemo(() => sy(n, max * 1.15), [n, max]);
  const hasPoints = n > 0 && safeGroups.length > 0;
  if (!hasPoints) {
    return (
      <div
        className="flex h-[240px] w-full items-center justify-center rounded-lg bg-neutral-50 text-[13px] text-neutral-500"
        role="img"
        aria-label="Bar chart — no data yet"
      >
        No bar data yet.
      </div>
    );
  }
  const safeIdx = idx !== null && idx >= 0 && idx < n ? idx : null;
  const count = normalized.length;
  const slot = (W - PAD.l - PAD.r) / Math.max(1, n);
  const bw = Math.min(24, (slot * 0.62) / Math.max(1, count));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Grouped bar chart"
      onMouseLeave={() => setIdx(null)}
    >
      {[0, 0.5, 1].map((f) => {
        const t = Math.round(max * 1.15 * f);
        return (
          <g key={f}>
            <line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} stroke="#EDEDEB" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#8A8A86">
              {formatCompact(t)}
            </text>
          </g>
        );
      })}
      {safeLabels.map((l, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        return (
          <g
            key={i}
            onMouseEnter={() => setIdx(i)}
            opacity={safeIdx === null || safeIdx === i ? 1 : 0.45}
          >
            {normalized.map((g, gi) => {
              const v = g.values[i] ?? 0;
              const bx = cx + (gi - (count - 1) / 2) * (bw + 5) - bw / 2;
              const h = Math.max(3, H - PAD.b - y(v));
              return (
                <g key={gi}>
                  <rect x={bx} y={y(v)} width={bw} height={h} rx="5" fill={g.color}>
                    <title>{`${l} · ${g.label}: ${formatY ? formatY(v) : v}`}</title>
                  </rect>
                  {safeIdx === i && (
                    <text
                      x={bx + bw / 2}
                      y={y(v) - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="#010101"
                    >
                      {formatY ? formatY(v) : v}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#8A8A86">
              {l.length > 14 ? l.slice(0, 13) + "…" : l}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
