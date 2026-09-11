import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-ink text-lg font-extrabold text-brand">
        HG
      </span>
      <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Error 404
      </p>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        The page you are looking for does not exist or you do not have access to it.
      </p>
      <div className="mt-5 flex gap-2">
        <Link href="/dashboard">
          <Button>Go to dashboard</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline">Sign in</Button>
        </Link>
      </div>
    </div>
  );
}
