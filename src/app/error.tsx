"use client";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-6 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">Something went wrong.</h1>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        {error.message || "We couldn't load this page. Please try again."}
      </p>
      <Button className="mt-5" variant="dark" onClick={reset}>
        Try Again
      </Button>
    </div>
  );
}
