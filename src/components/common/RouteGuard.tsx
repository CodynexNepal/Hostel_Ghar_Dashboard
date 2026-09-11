import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export function requirePermissionNote(): void {
  // Placeholder for future server-side session check.
  // Currently auth is client-side mock; pages render and gate via usePermissions.
  return;
}

export function LockedPage({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  // Rendered by route guards when plan lacks permission (client decides to show upgrade CTA).
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-surface-border bg-white px-6 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-neutral-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function redirectTo(href: string): never {
  redirect(href);
}
