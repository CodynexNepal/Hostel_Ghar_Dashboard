"use client";

import Link from "next/link";
import { ArrowRight, Clock, Crown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Owner subscription at-a-glance — rendered at the top of /dashboard so a
 * PRO owner sees their plan immediately after login without opening
 * /subscription. Live data comes from GET /subscriptions/current +
 * /check-limit; auth `user.subscription` is only the fallback.
 */
export function SubscriptionBanner() {
  const { user, subscriptionLoading } = useAuth();
  const {
    current,
    isLoading,
    activePlan,
    status,
    billingCycle,
    daysRemaining,
    residentLimit,
    residentCount,
    pendingRequest,
    reload,
  } = useSubscription();

  if (!user || user.role !== "HOSTEL_OWNER") return null;

  const loading = isLoading || subscriptionLoading;
  // First paint before live calls resolve — show skeleton, never a stale FREE flash.
  if (loading && !current) {
    return (
      <div aria-label="Loading subscription">
        <CardSkeleton />
      </div>
    );
  }

  const plan = (activePlan ?? user.subscription.plan ?? "FREE") as string;
  const liveStatus = status ?? user.subscription.status ?? null;
  const limit = residentLimit ?? user.subscription.residentsLimit ?? null;
  const used = residentCount ?? user.subscription.residentsUsed ?? 0;
  const isPaid = plan !== "FREE";
  const isPro = plan === "PRO";

  return (
    <div className="space-y-3">
      <Card className="border-brand-ink/15 bg-gradient-to-r from-brand-muted via-white to-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-ink text-brand"
              aria-hidden
            >
              <Crown className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Current plan · visible right after login
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-bold text-neutral-900">
                {plan}
                {liveStatus && (
                  <Badge tone={statusTone(liveStatus)} className="uppercase">
                    {liveStatus}
                  </Badge>
                )}
                {billingCycle && <Badge tone="gray">{billingCycle}</Badge>}
                {isPro && (
                  <Badge tone="green" className="uppercase">
                    Pro
                  </Badge>
                )}
              </p>
              <p className="mt-1 text-[13px] text-neutral-600">
                {limit == null ? (
                  <>Unlimited residents{used > 0 ? ` · ${used} in-house` : ""}</>
                ) : (
                  <>
                    {used} / {limit} residents used
                  </>
                )}
                {typeof daysRemaining === "number" && isPaid ? (
                  <>
                    {" "}
                    · Renews in {daysRemaining} day{daysRemaining === 1 ? "" : "s"}
                  </>
                ) : current?.subscription?.endDate ? (
                  <> · Ends {current.subscription.endDate}</>
                ) : !isPaid ? (
                  <> · Upgrade for unlimited residents, invoices & staff</>
                ) : null}
              </p>
              {limit != null && limit > 0 && (
                <div
                  className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-neutral-200/70"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Math.round((used / Math.max(1, limit)) * 100))}
                  aria-label="Resident usage"
                >
                  <div
                    className="h-full rounded-full bg-brand-ink transition-all duration-500"
                    style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/subscription"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              {isPaid ? "Manage subscription" : "View plans"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Card>

      {pendingRequest && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800"
        >
          <span className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>{pendingRequest.plan ?? "Paid"} request awaiting admin review.</strong> Your
              current {plan} plan stays active until payment is verified.
            </span>
          </span>
          <button
            type="button"
            onClick={() => reload()}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Refresh status
          </button>
        </div>
      )}
    </div>
  );
}
