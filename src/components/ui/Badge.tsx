import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  green: "bg-brand-muted text-brand-ink border border-brand",
  dark: "bg-neutral-900 text-white",
  gray: "bg-neutral-100 text-neutral-700",
  red: "bg-red-50 text-red-700 border border-red-200",
  amber: "bg-amber-50 text-amber-800 border border-amber-200",
  blue: "bg-blue-50 text-blue-700 border border-blue-200",
};

export function Badge({
  children,
  tone = "gray",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone] ?? tones.gray,
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): string {
  const s = status.toUpperCase();
  if (["PAID", "COMPLETED", "ACTIVE", "AVAILABLE"].includes(s)) return "green";
  if (["PENDING"].includes(s)) return "amber";
  if (["OVERDUE", "FAILED", "SUSPENDED"].includes(s)) return "red";
  if (["FULL", "MAINTENANCE", "PARTIAL"].includes(s)) return "blue";
  return "gray";
}
