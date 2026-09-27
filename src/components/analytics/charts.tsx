"use client";
import { cn } from "@/lib/utils";
export const PALETTE = {
  ink: "#010101", lime: "#C3FF7D", limeDark: "#65a30d",
  amber: "#F59E0B", red: "#EF4444", blue: "#3B82F6",
  violet: "#8B5CF6", teal: "#14B8A6", slate: "#94A3B8",
};
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T;
  onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={cn("h-7 rounded-md px-2.5 text-xs font-semibold transition-all",
            value === o.value ? "bg-brand-ink text-brand shadow-sm" : "text-neutral-500 hover:text-neutral-900")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
          <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: it.color }} />{it.label}
        </span>
      ))}
    </div>
  );
}
