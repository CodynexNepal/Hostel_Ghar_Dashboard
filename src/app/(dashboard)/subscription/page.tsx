"use client";
import Link from "next/link";
import { Crown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { PLANS } from "@/constants/plans";
import { formatCurrency } from "@/lib/utils";
import { Check } from "lucide-react";

export default function SubscriptionPage() {
  const { plan, switchPlan, user } = useAuth();
  const { success } = useToast();
  if (!user) return null;
  const pct = Math.min(
    100,
    (user.subscription.residentsUsed / Math.max(1, user.subscription.residentsLimit)) * 100
  );
  return (
    <DashboardShell title="Subscription" subtitle="Manage your plan, usage and billing.">
      <Protected permission="MANAGE_SUBSCRIPTION">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wide text-neutral-500">
                Current plan
              </p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-neutral-900">
                <Crown className="h-6 w-6" aria-hidden />
                {plan}
                <Badge tone="green" className="ml-1">
                  {user.subscription.status}
                </Badge>
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Renews {user.subscription.renewsAt} · Started {user.subscription.startedAt}
              </p>
            </div>
            <div className="w-full sm:max-w-xs">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-neutral-700">Residents</span>
                <span className="font-bold text-neutral-900">
                  {user.subscription.residentsUsed} / {user.subscription.residentsLimit}
                </span>
              </div>
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-100"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Resident usage"
              >
                <div
                  className="h-full rounded-full bg-brand-ink transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-500">
                {pct.toFixed(0)}% of resident capacity used
              </p>
            </div>
          </div>
        </Card>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const current = p.id === plan;
            return (
              <Card
                key={p.id}
                className={current ? "border-brand-ink p-5 ring-2 ring-brand" : "p-5"}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-bold text-neutral-900">{p.name}</p>
                  {current ? (
                    <Badge tone="green">Current</Badge>
                  ) : p.highlighted ? (
                    <Badge tone="dark">Popular</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-neutral-500">{p.description}</p>
                <p className="mt-3 text-2xl font-bold text-neutral-900">
                  {p.priceMonthly === 0 ? "Free" : formatCurrency(p.priceMonthly)}
                  <span className="text-[13px] font-medium text-neutral-500">/mo</span>
                </p>
                <ul className="mt-4 space-y-2">
                  {p.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2 text-[13px]">
                      <span
                        className={
                          f.included
                            ? "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand"
                            : "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-100"
                        }
                      >
                        {f.included && <Check className="h-3 w-3 text-brand-ink" aria-hidden />}
                      </span>
                      <span
                        className={
                          f.included ? "text-neutral-800" : "text-neutral-400 line-through"
                        }
                      >
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={current ? "outline" : "primary"}
                  className="mt-5 w-full"
                  disabled={current}
                  onClick={() => {
                    switchPlan(p.id);
                    success(
                      `Switched to ${p.name}`,
                      p.priceMonthly === 0 ? "Plan updated." : "Invoice sent to your email."
                    );
                  }}
                >
                  {current ? "Current Plan" : p.cta}
                </Button>
              </Card>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-neutral-400">
          Prices in NPR. Plan switching is mocked — wire to{" "}
          <span className="font-medium">POST /billing/subscribe</span> when the backend is ready.
        </p>
      </Protected>
    </DashboardShell>
  );
}
