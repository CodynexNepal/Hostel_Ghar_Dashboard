import Link from "next/link";
import { ChevronLeft } from "lucide-react";
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
    >
      <ChevronLeft className="h-4 w-4" /> {label}
    </Link>
  );
}
