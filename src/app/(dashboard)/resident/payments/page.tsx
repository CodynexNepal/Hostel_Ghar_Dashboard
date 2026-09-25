"use client";

import { useMemo, useState } from "react";
import {
  QrCode,
  Maximize2,
  Copy,
  Check,
  Download,
  AlertCircle,
  Smartphone,
  CreditCard,
  Building,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useMyFees } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";
import { useAuth } from "@/hooks/useAuth";
import { PaymentQrDialog } from "@/components/payments/PaymentQrDialog";
import { UploadProofDialog } from "@/components/payments/UploadProofDialog";
import { useMyPaymentProofs, proofStatusTone, proofStatusLabel } from "@/lib/payment-proofs";
import {
  PAYMENT_METHODS_META,
  downloadQrDataUrl,
  usePaymentQrs,
  type PaymentQrMethod,
} from "@/lib/payment-qr";
import type { Fee } from "@/lib/api-types";

export default function ResidentPaymentsPage() {
  const room = useMyRoomSummary();
  const { role, user } = useAuth();
  const { data, error, isLoading, retry, totalPendingDue } = useMyFees();
  const { byFeeId: proofByFee, refetch: refetchProofs } = useMyPaymentProofs(room.hostelId);
  const [uploadFee, setUploadFee] = useState<Fee | null>(null);
  const [method, setMethod] = useState<PaymentQrMethod>("ESEWA");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFee, setDialogFee] = useState<Fee | null>(null);
  const [copied, setCopied] = useState(false);

  // GET /resident — dedicated resident view (RESIDENT, OWNER, ADMIN all allowed).
  const { qrs, labels } = usePaymentQrs(room.hostelId, { mode: "resident", role });
  const fees = useMemo(() => data ?? [], [data]);
  const due = useMemo(() => fees.find((f) => f.status !== "PAID") ?? null, [fees]);

  const payableOf = (f: NonNullable<typeof due>) =>
    Number(f.totalPayable ?? f.amount) || 0;

  const currentMeta = PAYMENT_METHODS_META[method];
  const activeQrSrc = qrs[method];
  const activeAccountLabel = labels[method] || currentMeta.defaultLabel;

  function handleCopy(text: string) {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenQr(fee?: Fee) {
    setDialogFee(fee ?? due ?? null);
    setDialogOpen(true);
  }

  function handlePaidFromQr() {
    setDialogOpen(false);
    setUploadFee(dialogFee ?? due ?? null);
  }

  const methodIcons: Record<PaymentQrMethod, React.ReactNode> = {
    ESEWA: <Smartphone className="h-3.5 w-3.5" />,
    KHALTI: <CreditCard className="h-3.5 w-3.5" />,
    BANK: <Building className="h-3.5 w-3.5" />,
  };

  const activePayableAmount = due ? formatCurrency(payableOf(due)) : undefined;

  return (
    <DashboardShell title="My Payments" subtitle={room.hostelName}>
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Dues + Payment QR Section */}
        <div className="space-y-4 lg:col-span-5">
          {/* Main Due Summary Card */}
          <Card className="bg-gradient-to-br from-brand-ink via-slate-900 to-brand-ink p-6 text-white shadow-md">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-32 bg-white/20" />
                <Skeleton className="h-9 w-40 bg-white/20" />
              </div>
            ) : due ? (
              <>
                <p className="text-[13px] text-neutral-400">
                  Due · {due.month ?? (due.billingMonth && due.billingYear ? `Month ${due.billingMonth} ${due.billingYear}` : "Current billing")}
                </p>
                <p className="mt-1 text-3xl font-extrabold text-brand tracking-tight">
                  {formatCurrency(payableOf(due))}
                </p>
                <p className="mt-1 text-[13px] text-neutral-300">
                  {due.dueDate ? `Due by ${formatDate(due.dueDate)}` : "Pay before the 10th"}
                  {totalPendingDue !== null && totalPendingDue !== payableOf(due)
                    ? ` · Total pending ${formatCurrency(totalPendingDue)}`
                    : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] text-neutral-400">Dues</p>
                <p className="mt-1 text-2xl font-bold text-brand">All clear 🎉</p>
                <p className="mt-1 text-[13px] text-neutral-400">No pending fees right now.</p>
              </>
            )}

            {/* Payment Method Selector Tabs */}
            <div className="mt-5">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
                Payment Options (Click to view QR)
              </label>
              <div
                className="grid grid-cols-3 gap-2"
                role="radiogroup"
                aria-label="Payment method"
              >
                {(["ESEWA", "KHALTI", "BANK"] as const).map((m) => {
                  const isSelected = method === m;
                  const hasQr = Boolean(qrs[m]);

                  return (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setMethod(m)}
                      className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-brand text-brand-ink shadow-sm ring-2 ring-white/30"
                          : "bg-white/10 text-neutral-200 hover:bg-white/20 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {methodIcons[m]}
                        <span>{PAYMENT_METHODS_META[m].label}</span>
                      </span>
                      <span
                        className={`mt-1 text-[10px] font-medium ${
                          isSelected ? "text-brand-ink/70" : hasQr ? "text-emerald-300" : "text-neutral-400"
                        }`}
                      >
                        {hasQr ? "QR Ready" : "QR"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick helper note */}
            <div className="mt-4 flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-xs text-neutral-200">
              <span>Pay via <strong>{currentMeta.label}</strong> QR below</span>
              <button
                type="button"
                onClick={() => handleOpenQr()}
                className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
              >
                <Maximize2 className="h-3 w-3" /> Fullscreen
              </button>
            </div>
          </Card>

          {/* Interactive QR Display Card */}
          <Card className="border border-neutral-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100">
                  {methodIcons[method]}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {currentMeta.label} Payment QR
                  </h3>
                  <p className="text-[11px] text-neutral-500">{currentMeta.tagline}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenQr()}
                className="gap-1 text-xs"
              >
                <Maximize2 className="h-3 w-3" /> Enlarge
              </Button>
            </div>

            <div className="mt-4 flex flex-col items-center">
              {activeQrSrc ? (
                <>
                  {/* QR Image with Click to Zoom */}
                  <button
                    type="button"
                    onClick={() => handleOpenQr()}
                    title="Click to enlarge QR"
                    className="group relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-200 transition-all hover:ring-2 hover:ring-brand"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeQrSrc}
                      alt={`${currentMeta.label} payment QR`}
                      className="h-52 w-52 rounded-xl object-contain transition-transform group-hover:scale-102"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                      <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-neutral-900 shadow">
                        <QrCode className="h-3.5 w-3.5" /> Tap to Scan
                      </span>
                    </div>
                  </button>

                  {/* Account / Merchant info bar with copy button */}
                  <div className="mt-3.5 flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-left">
                    <div className="min-w-0 pr-2">
                      <p className="text-[10px] font-medium uppercase text-neutral-400">
                        {method === "BANK" ? "Bank / A/C Info" : `${currentMeta.label} Account ID`}
                      </p>
                      <p className="truncate text-xs font-semibold text-neutral-800">
                        {activeAccountLabel}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(activeAccountLabel)}
                      className="h-7 shrink-0 gap-1 text-xs text-neutral-700"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 flex w-full gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => {
                        const fname = `${(room.hostelName || "hostel").toLowerCase().replace(/\s+/g, "-")}-${method.toLowerCase()}-qr.png`;
                        downloadQrDataUrl(activeQrSrc, fname);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> Save QR Image
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1 text-xs"
                      onClick={() => handleOpenQr()}
                    >
                      <QrCode className="h-3.5 w-3.5" /> Scan & Pay
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-neutral-800">
                    No {currentMeta.label} QR yet
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-neutral-500">
                    The hostel owner hasn&apos;t uploaded a {currentMeta.label} QR. You can switch to another payment option above or pay at the desk.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 border border-amber-200">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    <span>Ask hostel desk to add QR in Settings</span>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <p className="mt-3.5 text-center text-xs text-neutral-500">
                After paying via QR, upload your receipt screenshot — owner reviews it and marks your fee paid.
              </p>
              {due && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadFee(due)}
                  className="mt-2 w-full gap-1.5 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5 rotate-180" /> Upload payment receipt
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Fee Ledger / Dues History */}
        <div className="space-y-4 lg:col-span-7">
          <Card>
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
              <div>
                <p className="text-[15px] font-semibold">Current dues</p>
                <p className="text-[13px] text-neutral-500">Your monthly fee ledger and invoices</p>
              </div>
              {due && (
                <Button
                  size="sm"
                  onClick={() => handleOpenQr(due)}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <QrCode className="h-3.5 w-3.5" /> Pay Now via QR
                </Button>
              )}
            </div>

            {isLoading ? (
              <p className="px-5 py-6 text-sm text-neutral-500" role="status">
                Loading fees…
              </p>
            ) : error ? (
              <div className="p-5">
                <ErrorState title="Couldn't load fees" description={error.message} onRetry={retry} />
              </div>
            ) : fees.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No fees yet" description="Your monthly ledger will appear here." />
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {fees.map((p) => {
                  const isUnpaid = p.status !== "PAID";
                  const proof = proofByFee.get(String(p.id));
                  const billMonth =
                    p.month ??
                    (p.billingMonth && p.billingYear
                      ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][p.billingMonth - 1]} ${p.billingYear}`
                      : "Fee");
                  const amount = Number(p.totalPayable ?? p.amount);

                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-900">{billMonth}</span>
                          <span className="text-sm font-bold text-neutral-700">·</span>
                          <span className="text-sm font-extrabold text-neutral-900">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {p.dueDate ? `Due: ${formatDate(p.dueDate)}` : ""}
                          {p.method ? ` · Method: ${p.method}` : ""}
                          {p.paidAmount ? ` · Paid: ${formatCurrency(Number(p.paidAmount))}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                        {proof && (
                          <Badge tone={proofStatusTone(proof.status)}>{proofStatusLabel(proof.status)}</Badge>
                        )}
                        {isUnpaid && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenQr(p)}
                            className="gap-1.5 text-xs font-semibold text-neutral-900 hover:border-brand-ink"
                          >
                            <QrCode className="h-3.5 w-3.5 text-brand-ink" /> Pay via QR
                          </Button>
                        )}
                        {isUnpaid && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setUploadFee(p)}
                            className="gap-1 text-xs font-semibold"
                            title={proof ? "Resubmit receipt" : "Upload receipt"}
                          >
                            <Download className="h-3.5 w-3.5 rotate-180" />
                            {proof ? "Resubmit" : "Upload receipt"}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Full-featured QR Payment Modal */}
      <PaymentQrDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onPaid={handlePaidFromQr}
        method={method}
        hostelId={room.hostelId}
        hostelName={room.hostelName}
        amountLabel={
          dialogFee
            ? formatCurrency(Number(dialogFee.totalPayable ?? dialogFee.amount))
            : activePayableAmount
        }
        feeDescription={
          dialogFee?.month ??
          (dialogFee?.billingMonth && dialogFee?.billingYear
            ? `${dialogFee.billingMonth}/${dialogFee.billingYear}`
            : undefined)
        }
      />
      {/* Receipt upload — after QR pay, resident submits proof for review */}
      <UploadProofDialog
        open={Boolean(uploadFee)}
        onClose={() => setUploadFee(null)}
        fee={uploadFee}
        hostelId={room.hostelId}
        residentId={user?.id ?? null}
        residentName={user?.name}
        residentEmail={user?.email}
        roomNumber={room.myRoom?.roomNumber}
        existingProof={uploadFee ? (proofByFee.get(String(uploadFee.id)) ?? null) : null}
        onSubmitted={() => refetchProofs()}
      />
    </DashboardShell>
  );
}
