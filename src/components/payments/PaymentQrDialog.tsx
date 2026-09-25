"use client";

import { useEffect, useState } from "react";
import {
  QrCode,
  Download,
  Copy,
  Check,
  Building,
  Smartphone,
  CreditCard,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import {
  PAYMENT_METHODS_META,
  downloadQrDataUrl,
  usePaymentQrs,
  type PaymentQrMethod,
} from "@/lib/payment-qr";

interface PaymentQrDialogProps {
  open: boolean;
  onClose: () => void;
  method?: PaymentQrMethod;
  hostelId?: string | null;
  hostelName?: string;
  amountLabel?: string;
  feeDescription?: string;
  /** "resident" (default) hits GET /resident; "preview" hits GET /preview. */
  mode?: "resident" | "preview";
  /** Fired when resident taps "I've Paid" — caller opens receipt upload. */
  onPaid?: () => void;
}

export function PaymentQrDialog({
  open,
  onClose,
  method: initialMethod = "ESEWA",
  hostelId,
  hostelName = "Hostel Ghar",
  amountLabel,
  feeDescription,
  mode = "resident",
  onPaid,
}: PaymentQrDialogProps) {
  const { success } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentQrMethod>(initialMethod);
  const [copied, setCopied] = useState(false);
  const { qrs, labels } = usePaymentQrs(hostelId, { mode });

  useEffect(() => {
    if (open && initialMethod) {
      setSelectedMethod(initialMethod);
    }
  }, [open, initialMethod]);

  const currentMeta = PAYMENT_METHODS_META[selectedMethod];
  const qrSrc = qrs[selectedMethod];
  const accountLabel = labels[selectedMethod] || currentMeta.defaultLabel;

  function handleCopyAccount() {
    if (!accountLabel) return;
    void navigator.clipboard.writeText(accountLabel);
    setCopied(true);
    success("Copied to clipboard", accountLabel);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!qrSrc) return;
    const filename = `${hostelName.toLowerCase().replace(/\s+/g, "-")}-${selectedMethod.toLowerCase()}-qr.png`;
    downloadQrDataUrl(qrSrc, filename);
    success("Download started", `Saved ${currentMeta.label} QR to your device`);
  }

  const methodIcons: Record<PaymentQrMethod, React.ReactNode> = {
    ESEWA: <Smartphone className="h-4 w-4" />,
    KHALTI: <CreditCard className="h-4 w-4" />,
    BANK: <Building className="h-4 w-4" />,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hostel Payment QR"
      description={`Scan to pay ${hostelName} directly via mobile wallet or banking`}
    >
      <div className="space-y-4">
        {/* Fee Amount Banner */}
        {amountLabel && (
          <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-ink via-slate-900 to-brand-ink p-3.5 text-white shadow-sm">
            <div>
              <p className="text-xs text-neutral-400">Total Payable Amount</p>
              <p className="text-xl font-bold text-brand">{amountLabel}</p>
            </div>
            {feeDescription && (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-neutral-200">
                {feeDescription}
              </span>
            )}
          </div>
        )}

        {/* Payment Method Selector Tabs */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Select Payment Option
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["ESEWA", "KHALTI", "BANK"] as const).map((m) => {
              const meta = PAYMENT_METHODS_META[m];
              const isSelected = selectedMethod === m;
              const hasQr = Boolean(qrs[m]);

              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMethod(m)}
                  className={`group relative flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all ${
                    isSelected
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-md ring-2 ring-brand/50"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        isSelected ? "text-brand" : "text-neutral-500 group-hover:text-neutral-900"
                      }`}
                    >
                      {methodIcons[m]}
                    </span>
                    <span>{meta.label}</span>
                  </div>
                  <span
                    className={`mt-1 text-[10px] ${
                      isSelected ? "text-neutral-300" : hasQr ? "text-emerald-600 font-medium" : "text-neutral-400"
                    }`}
                  >
                    {hasQr ? "QR Available" : "QR Setup"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* QR Display Area */}
        <div className="flex flex-col items-center rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4">
          {qrSrc ? (
            <div className="flex flex-col items-center">
              {/* Scan Frame */}
              <div className="relative rounded-2xl bg-white p-3 shadow-md ring-1 ring-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt={`${currentMeta.label} QR for ${hostelName}`}
                  className="h-60 w-60 rounded-xl object-contain"
                />
                {/* Corner guide accents */}
                <div
                  className="absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 rounded-tl-sm"
                  style={{ borderColor: currentMeta.brandColor }}
                />
                <div
                  className="absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 rounded-tr-sm"
                  style={{ borderColor: currentMeta.brandColor }}
                />
                <div
                  className="absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 rounded-bl-sm"
                  style={{ borderColor: currentMeta.brandColor }}
                />
                <div
                  className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 rounded-br-sm"
                  style={{ borderColor: currentMeta.brandColor }}
                />
              </div>

              {/* Account Details Box */}
              <div className="mt-3.5 flex w-full max-w-sm items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left shadow-xs">
                <div className="min-w-0 pr-2">
                  <p className="text-[11px] font-medium text-neutral-400">
                    {selectedMethod === "BANK" ? "Bank / A/C Info" : `${currentMeta.label} Account`}
                  </p>
                  <p className="truncate text-xs font-semibold text-neutral-800">
                    {accountLabel}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyAccount}
                  className="shrink-0 h-8 gap-1 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex w-full max-w-sm gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex-1 text-xs"
                >
                  <Download className="h-3.5 w-3.5" /> Save QR Code
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onPaid?.();
                  }}
                  className="flex-1 text-xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> I&apos;ve Paid
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
                <QrCode className="h-8 w-8" />
              </div>
              <p className="mt-3 text-sm font-semibold text-neutral-800">
                No {currentMeta.label} QR uploaded yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-neutral-500">
                The hostel owner hasn&apos;t added their {currentMeta.label} QR yet. You can switch to another payment method above or ask the warden.
              </p>
              <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-200/80">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Hostel owner can configure QRs under Settings → Payment QRs</span>
              </div>
            </div>
          )}
        </div>

        {/* Step-by-step instructions */}
        <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 text-[12px] text-neutral-600">
          <p className="font-semibold text-neutral-800">How to pay:</p>
          <ol className="mt-1 list-inside list-decimal space-y-0.5 text-neutral-500">
            <li>Open your {currentMeta.label} or mobile banking app</li>
            <li>Scan the QR code above or save image to scan from gallery</li>
            <li>Enter exact amount and put your <strong>Name & Room No</strong> in remarks</li>
            <li>Tap <strong>I&apos;ve Paid</strong> below, then upload the success screenshot</li>
          </ol>
        </div>
      </div>
    </Modal>
  );
}
