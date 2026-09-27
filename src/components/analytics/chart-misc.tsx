"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
export function Donut({ slices, centerTop, centerBottom, size = 164 }: {
  slices: { color: string; label: string; value: number; display?: string }[];
  centerTop: string; centerBottom?: string; size?: number;
}) {
  const total = Math.max(1, slices.reduce((a, s) => a + s.value, 0));
  const R = 62; const C = 2 * Math.PI * R;
  const [active, setActive] = useState<number | null>(null);
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="shrink-0" onMouseLeave={() => setActive(null)}>
        <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label={`${centerTop} ${centerBottom ?? ""}`}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="#F1F1EF" strokeWidth="20" />
          {slices.map((s, i) => {
            const frac = s.value / total;
            const el = (
              <circle key={s.label} cx="80" cy="80" r={R} fill="none" stroke={s.color} strokeWidth={active === i ? 23 : 20}
                strokeDasharray={`${Math.max(0, frac * C - 2)} ${C}`} strokeDashoffset={-acc * C + C * 0.25}
                transform="rotate(-90 80 80)" opacity={active === null || active === i ? 1 : 0.35}
                style={{ transition: "all 180ms", cursor: "pointer" }} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} tabIndex={0}>
                <title>{`${s.label}: ${s.display ?? s.value} (${Math.round(frac * 1000) / 10}%)`}</title>
              </circle>
            );
            acc += frac;
            return el;
          })}
          <text x="80" y="78" textAnchor="middle" fontSize="21" fontWeight="800" fill="#010101">{centerTop}</text>
          {centerBottom && <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#737373">{centerBottom}</text>}
        </svg>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.label} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition", active === i && "bg-surface-muted")}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">{s.label}</span>
            <span className="font-bold tabular-nums text-neutral-900">{s.display ?? s.value}</span>
            <span className="w-12 text-right tabular-nums text-neutral-500">{Math.round((s.value / total) * 1000) / 10}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function Insight({ tone = "info", title, body }: { tone?: "good" | "warn" | "bad" | "info"; title: string; body: string }) {
  const map = { good: "border-brand bg-[#F4FFDF]", warn: "border-amber-300 bg-amber-50", bad: "border-red-300 bg-red-50", info: "border-neutral-300 bg-surface-muted" };
  const dot = { good: "bg-[#65a30d]", warn: "bg-amber-500", bad: "bg-red-500", info: "bg-neutral-500" };
  return (
    <div className={cn("mt-3 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-snug text-neutral-800", map[tone])} role="note">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot[tone])} aria-hidden />
      <p><strong className="font-semibold">{title} </strong>{body}</p>
    </div>
  );
}
