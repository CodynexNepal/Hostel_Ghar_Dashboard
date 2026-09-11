"use client";

import Link from "next/link";
import { Check, Crown, Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useUpgrade, upsellFor } from "@/hooks/useUpgrade";

export function UpgradeModal() {
  const { open, permission, closeUpgrade } = useUpgrade();
  const upsell = upsellFor(permission);

  return (
    <Modal open={open} onClose={closeUpgrade} labelledBy="upgrade-title">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-ink">
          <Lock className="h-5 w-5 text-brand" aria-hidden />
        </div>
        <h2 id="upgrade-title" className="mt-4 text-lg font-semibold text-neutral-900">
          {upsell.title}
        </h2>
        <p className="mt-1 max-w-xs text-sm text-neutral-500">
          Your current plan does not include this feature. Upgrade your plan to unlock:
        </p>
        <ul className="mt-4 w-full space-y-2 rounded-card border border-surface-border bg-surface-muted p-4 text-left">
          {upsell.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-neutral-800">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand">
                <Check className="h-3 w-3 text-brand-ink" aria-hidden />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-5 grid w-full gap-2">
          <Link href="/subscription" onClick={closeUpgrade}>
            <Button className="w-full" size="lg">
              <Crown className="h-4 w-4" aria-hidden /> Upgrade Plan
            </Button>
          </Link>
          <Button variant="ghost" onClick={closeUpgrade}>
            Maybe Later
          </Button>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Frontend gating is UX-only. Backend enforces authorization.
        </p>
      </div>
    </Modal>
  );
}
