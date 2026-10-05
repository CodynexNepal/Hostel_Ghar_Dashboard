"use client";
import { useMemo, useRef, useState } from "react";
import { Check, Clock, Crown, History, ImagePlus } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { PlatformQrPanel } from "@/components/subscription/PlatformQrPanel";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { CardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { useSubscription } from "@/hooks/useSubscription";
import { PLANS } from "@/constants/plans";
import type { Plan } from "@/types/subscription";
import type {
  BillingCycle,
  SubscriptionHistoryItem,
  SubscriptionPaymentMethod,
} from "@/lib/api-types";
import { formatCurrency, formatDate } from "@/lib/utils";

const PAYMENT_METHODS: SubscriptionPaymentMethod[] = ["ESEWA", "KHALTI", "BANK", "CASH"];

const historyColumns: Column<SubscriptionHistoryItem>[] = [
  {
    key: "plan",
    header: "Plan",
    sortable: true,
    render: (r) => <span className="font-medium text-neutral-900">{r.plan ?? "FREE"}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <Badge tone={statusTone(String(r.status ?? ""))}>{r.status ?? "—"}</Badge>,
  },
  { key: "cycle", header: "Cycle", render: (r) => r.billingCycle ?? "—" },
  {
    key: "price",
    header: "Price",
    sortable: true,
    render: (r) => (r.price != null ? formatCurrency(Number(r.price)) : "—"),
  },
  {
    key: "period",
    header: "Period",
    render: (r) => `${formatDate(r.startDate)} → ${r.endDate ? formatDate(r.endDate) : "ongoing"}`,
  },
  {
    key: "hostel",
    header: "Hostel",
    render: (r) => r.hostelName ?? r.hostel?.name ?? r.hostelId ?? "—",
  },
];

function historyRowKey(r: SubscriptionHistoryItem): string {
  return r.id ?? `${r.plan ?? "FREE"}-${r.startDate ?? r.createdAt ?? ""}`;
}

export default function SubscriptionPage() {
  const { success, error: toastError } = useToast();
  const {
    plans: backendPlans,
    current,
    history,
    hostelId,
    isLoading,
    isMutating,
    error,
    actionError,
    activePlan,
    status,
    billingCycle,
    daysRemaining,
    residentLimit,
    residentCount,
    pendingRequest,
    reload,
    subscribe,
    cancel,
  } = useSubscription();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [paymentMethod, setPaymentMethod] = useState<SubscriptionPaymentMethod>("ESEWA");
  const [paymentReference, setPaymentReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const proofRef = useRef<HTMLInputElement | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const backendById = useMemo(() => new Map(backendPlans.map((p) => [p.id, p])), [backendPlans]);
  const pct =
    residentLimit && residentLimit > 0 ? Math.min(100, (residentCount / residentLimit) * 100) : 0;
  const hasActiveSub = status === "ACTIVE" && activePlan !== "FREE";

  function resetPlanModal() {
    setPendingPlan(null);
    setProofFile(null);
    setProofError(null);
    setPaymentReference("");
    setPaymentMethod("ESEWA");
    if (proofRef.current) proofRef.current.value = "";
  }

  function pickProof(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProofError("Payment proof must be an image file (screenshot of the success page).");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setProofError("Payment proof must be under 4 MB.");
      return;
    }
    setProofError(null);
    setProofFile(file);
  }

  async function doSubscribe() {
    if (!pendingPlan) return;
    const needsProof = pendingPlan.priceMonthly > 0;

    if (needsProof && !proofFile) {
      setProofError("Upload your payment success screenshot to submit the request.");
      return;
    }

    const ok = await subscribe({
      plan: pendingPlan.id,
      billingCycle: cycle,
      ...(needsProof
        ? {
            paymentMethod,
            paymentReference: paymentReference.trim() || undefined,
            proof: proofFile ?? undefined,
          }
        : {}),
    });
    if (ok) {
      if (needsProof) {
        success(
          "Payment proof submitted",
          `${pendingPlan.name} · ${cycle === "YEARLY" ? "Yearly" : "Monthly"} — your plan changes after admin verification.`
        );
      } else {
        success("Subscription updated", `${pendingPlan.name} is now your plan.`);
      }
      resetPlanModal();
    } else {
      toastError("Couldn't update subscription", "Check the error in the dialog and try again.");
    }
  }

  async function doCancel() {
    const ok = await cancel();
    if (ok) {
      success("Subscription cancelled", "Your hostel now falls back to the Free plan.");
      setConfirmCancel(false);
    } else {
      toastError("Couldn't cancel subscription", "Check the error in the dialog and try again.");
    }
  }

  if (isLoading && !current && backendPlans.length === 0) {
    return (
      <DashboardShell title="Subscription" subtitle="Manage your plan, usage and billing.">
        <Protected permission="MANAGE_SUBSCRIPTION">
          <TableSkeleton rows={4} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p) => (
              <CardSkeleton key={p.id} />
            ))}
          </div>
        </Protected>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Subscription" subtitle="Manage your plan, usage and billing.">
      <Protected permission="MANAGE_SUBSCRIPTION">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wide text-neutral-500">
                Current plan
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold text-neutral-900">
                <Crown className="h-6 w-6" aria-hidden />
                {activePlan}
                <Badge tone={status ? statusTone(status) : "gray"} className="ml-1">
                  {status ?? "FREE TIER"}
                </Badge>
                {billingCycle && <Badge tone="gray">{billingCycle}</Badge>}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {current?.subscription?.startDate
                  ? `Started ${formatDate(current.subscription.startDate)}`
                  : "No paid subscription yet"}
                {current?.subscription?.endDate
                  ? ` · Ends ${formatDate(current.subscription.endDate)}`
                  : ""}
                {hasActiveSub && daysRemaining != null
                  ? ` · Renews in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            <div className="w-full sm:max-w-xs">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-neutral-700">Residents</span>
                <span className="font-bold text-neutral-900">
                  {residentCount} / {residentLimit == null ? "Unlimited" : residentLimit}
                </span>
              </div>
              {residentLimit != null && residentLimit > 0 ? (
                <>
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
                </>
              ) : (
                <p className="mt-1.5 text-xs text-neutral-500">Unlimited residents on this plan.</p>
              )}
              {hasActiveSub && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancel subscription
                </Button>
              )}
            </div>
          </div>
          {!hostelId && !isLoading && (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <span>No hostel linked to your account — link one to load subscription data.</span>
              <button
                type="button"
                onClick={() => reload()}
                className="shrink-0 font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}
          {pendingRequest && (
            <div
              role="status"
              className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800"
            >
              <span className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong>
                    {pendingRequest.plan ?? "Paid"} plan request awaiting admin review.
                  </strong>{" "}
                  Payment proof submitted
                  {pendingRequest.createdAt ? ` on ${formatDate(pendingRequest.createdAt)}` : ""} —
                  your current plan stays active until the payment is verified.
                </span>
              </span>
              <button
                type="button"
                onClick={() => reload()}
                className="shrink-0 font-semibold underline"
              >
                Refresh
              </button>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => reload()}
                className="shrink-0 font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}
        </Card>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const backend = backendById.get(p.id);
            const isCurrentTier = p.id === activePlan || Boolean(backend?.isCurrent);
            // One payment request at a time — block further upgrades until the
            // admin reviews the pending proof (FREE downgrade stays available).
            const awaitingApproval = p.id !== "FREE" && pendingRequest !== null;
            const buttonLabel = isCurrentTier
              ? "Current Plan"
              : awaitingApproval
                ? "Awaiting approval"
                : p.id === "FREE"
                  ? "Downgrade to Free"
                  : (backend?.cta ?? p.cta);
            return (
              <Card
                key={p.id}
                className={isCurrentTier ? "border-brand-ink p-5 ring-2 ring-brand" : "p-5"}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-bold text-neutral-900">
                    {backend?.name || p.name}
                  </p>
                  {isCurrentTier ? (
                    <Badge tone="green">Current</Badge>
                  ) : p.highlighted ? (
                    <Badge tone="dark">Popular</Badge>
                  ) : backend?.badge ? (
                    <Badge tone="blue">{backend.badge}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-neutral-500">
                  {backend?.tagline || p.description}
                </p>
                <p className="mt-3 text-2xl font-bold text-neutral-900">
                  {p.priceMonthly === 0 ? "Free" : formatCurrency(p.priceMonthly)}
                  <span className="text-[13px] font-medium text-neutral-500">/mo</span>
                  {p.priceMonthly > 0 && (
                    <span className="block text-xs font-normal text-neutral-400">
                      {formatCurrency(p.priceYearly)}/yr
                    </span>
                  )}
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
                  variant={isCurrentTier ? "outline" : "primary"}
                  className="mt-5 w-full"
                  disabled={isCurrentTier || awaitingApproval}
                  onClick={() => {
                    setCycle("MONTHLY");
                    setProofFile(null);
                    setProofError(null);
                    setPaymentReference("");
                    if (proofRef.current) proofRef.current.value = "";
                    setPendingPlan(p);
                  }}
                >
                  {buttonLabel}
                </Button>
              </Card>
            );
          })}
        </div>
        {history.length > 0 && (
          <div className="mt-6">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
              <History className="h-4 w-4" aria-hidden /> Billing history
            </h2>
            <div className="mt-3">
              <DataTable
                columns={historyColumns}
                rows={history}
                rowKey={historyRowKey}
                pageSize={5}
                searchPlaceholder="Search billing history…"
                searchableKeys={["plan", "status"]}
              />
            </div>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-neutral-400">
          Prices in NPR. Paid plan changes require a payment-success screenshot — an admin verifies
          the payment and only then is your plan activated.
        </p>
        <Modal
          open={pendingPlan !== null}
          onClose={resetPlanModal}
          size="lg"
          title={pendingPlan ? `Switch to ${pendingPlan.name}` : undefined}
          description={
            pendingPlan && pendingPlan.priceMonthly > 0
              ? "Upload your payment success screenshot. Our team verifies the payment and activates the plan — you keep your current plan until then."
              : "Confirm the plan change — your previous plan is deactivated immediately."
          }
        >
          {pendingPlan && (
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 rounded-md bg-surface-muted p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Price</span>
                  <span className="font-semibold text-neutral-900">
                    {pendingPlan.priceMonthly === 0
                      ? "Free"
                      : formatCurrency(
                          cycle === "YEARLY" ? pendingPlan.priceYearly : pendingPlan.priceMonthly
                        )}
                    {pendingPlan.priceMonthly > 0 && (cycle === "YEARLY" ? "/yr" : "/mo")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Residents</span>
                  <span className="font-semibold text-neutral-900">
                    {pendingPlan.residentLimit == null
                      ? "Unlimited"
                      : `Up to ${pendingPlan.residentLimit}`}
                  </span>
                </div>
              </div>
              {pendingPlan.priceMonthly > 0 && (
                <fieldset>
                  <legend className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                    Billing cycle
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(["MONTHLY", "YEARLY"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCycle(c)}
                        aria-pressed={cycle === c}
                        className={
                          cycle === c
                            ? "rounded-md border border-brand-ink bg-brand px-3 py-2 text-sm font-semibold text-brand-ink"
                            : "rounded-md border border-surface-border bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-surface-muted"
                        }
                      >
                        {c === "MONTHLY" ? "Monthly" : "Yearly"}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {pendingPlan.priceMonthly > 0 && (
                <div className="space-y-3 border-t border-surface-border pt-3 sm:space-y-4 sm:pt-4">
                  <fieldset>
                    <legend className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                      Step 1 — Pay via <span className="text-red-500">*</span>
                    </legend>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          aria-pressed={paymentMethod === m}
                          className={
                            paymentMethod === m
                              ? "rounded-md border border-brand-ink bg-brand px-2 py-2 text-xs font-semibold text-brand-ink"
                              : "rounded-md border border-surface-border bg-white px-2 py-2 text-xs text-neutral-700 hover:bg-surface-muted"
                          }
                        >
                          {m === "ESEWA"
                            ? "eSewa"
                            : m === "KHALTI"
                              ? "Khalti"
                              : m === "BANK"
                                ? "Bank"
                                : "Cash"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <PlatformQrPanel
                    amount={cycle === "YEARLY" ? pendingPlan.priceYearly : pendingPlan.priceMonthly}
                    cycleLabel={cycle === "YEARLY" ? "/yr" : "/mo"}
                    planName={`${pendingPlan.name} · ${cycle === "YEARLY" ? "Yearly" : "Monthly"}`}
                    method={paymentMethod}
                  />
                  <Input
                    label="Payment reference (optional)"
                    placeholder="eSewa / Khalti trace ID, cheque or transaction no."
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                  />
                  <div>
                    <span className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                      Step 2 — Payment success screenshot <span className="text-red-500">*</span>
                    </span>
                    <input
                      ref={proofRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      aria-label="Upload payment proof screenshot"
                      onChange={pickProof}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => proofRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4" />
                        {proofFile ? "Replace screenshot" : "Upload screenshot"}
                      </Button>
                      <span className="text-xs text-neutral-500">
                        {proofFile ? proofFile.name : "JPG / PNG / WEBP up to 4 MB"}
                      </span>
                    </div>
                    {proofError && (
                      <p role="alert" className="mt-1.5 text-[13px] text-red-600">
                        {proofError}
                      </p>
                    )}
                  </div>
                  <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-neutral-600">
                    Pay{" "}
                    {formatCurrency(
                      cycle === "YEARLY" ? pendingPlan.priceYearly : pendingPlan.priceMonthly
                    )}
                    {cycle === "YEARLY" ? "/yr" : "/mo"} using the method above, then upload the
                    success screen. Your plan activates after an admin verifies the payment.
                  </p>
                </div>
              )}
              {actionError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {actionError}
                </p>
              )}
              <div className="sticky bottom-0 -mx-1 flex gap-2 border-t border-surface-border bg-white/95 px-1 pb-1 pt-3 backdrop-blur">
                <Button
                  variant="outline"
                  onClick={resetPlanModal}
                  disabled={isMutating}
                  className="flex-1 sm:flex-none"
                >
                  Back
                </Button>
                <Button onClick={doSubscribe} loading={isMutating} className="flex-1 sm:flex-none">
                  {pendingPlan.priceMonthly > 0 ? "Submit for review" : "Downgrade now"}
                </Button>
              </div>
            </div>
          )}
        </Modal>
        <Modal
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          title="Cancel subscription?"
          description={
            current?.subscription?.endDate
              ? `${activePlan} stays active until ${formatDate(current.subscription.endDate)}.`
              : `${activePlan} stays active until the end of the billing period.`
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Afterwards your hostel falls back to the Free plan (10 residents). You can resubscribe
              any time.
            </p>
            {actionError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmCancel(false)}
                disabled={isMutating}
              >
                Keep plan
              </Button>
              <Button onClick={doCancel} loading={isMutating}>
                Cancel subscription
              </Button>
            </div>
          </div>
        </Modal>
      </Protected>
    </DashboardShell>
  );
}
