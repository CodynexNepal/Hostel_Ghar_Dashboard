"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Copy, Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/utils";
import {
  PLATFORM_QR_EVENT,
  getPlatformQr,
  platformMethodLabel,
  type PlatformQrMethod,
} from "@/lib/platform-qr";
import type { SubscriptionPaymentMethod } from "@/lib/api-types";

interface Props {
  amount: number;
  cycleLabel: string;
  planName: string;
  method: SubscriptionPaymentMethod;
}

/**
 * Step 1 of buying a subscription: scan the official Hostel Ghar QR and
 * pay the exact plan amount. CASH shows an in-person note (no QR).
 */
export function PlatformQrPanel({ amount, cycleLabel, planName, method }: Props) {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const isQr = method === "ESEWA" || method === "KHALTI" || method === "BANK";
  const [qrVersion, setQrVersion] = useState(0);
  useEffect(() => {
    setImgFailed(false);
    const bump = () => {
      setQrVersion((v) => v + 1);
      setImgFailed(false);
    };
    window.addEventListener(PLATFORM_QR_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(PLATFORM_QR_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, [method]);
  void qrVersion;
  const qr = isQr ? getPlatformQr(method as PlatformQrMethod) : null;

  if (!qr) {
    return (
      <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-neutral-600">
        Cash / in-person payment — contact the Hostel Ghar team, pay, then upload any receipt photo
        below as proof.
      </p>
    );
  }

  function copyLabel() {
    void navigator.clipboard?.writeText(qr!.label).catch(() => undefined);
    setCopied(true);
    success("Copied", qr!.label);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadQr() {
    if (imgFailed) return;
    const a = document.createElement("a");
    a.href = qr!.src;
    a.download = `hostel-ghar-${qr!.method.toLowerCase()}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    success("Download started", `${platformMethodLabel(qr!.method)} QR saved`);
  }

  // Reset the broken-image fallback whenever the QR source changes.
  const qrKey = `${qr.method}:${qr.src}`;
  const isDataUrl = qr.src.startsWith("data:");

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border">
      <div className="flex flex-wrap items-center justify-between gap-1 bg-brand-ink px-3 py-2 text-white sm:px-3.5">
        <p className="text-[11px] font-semibold sm:text-xs">
          Hostel Ghar official {platformMethodLabel(qr.method)} QR
        </p>
        <p className="text-[11px] font-bold text-brand sm:text-xs">
          {formatCurrency(amount)}
          <span className="font-medium text-neutral-300">{cycleLabel}</span>
        </p>
      </div>
      <div className="flex items-start gap-3 bg-white px-3 py-3 sm:gap-3.5 sm:px-3.5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-surface-border bg-surface-muted sm:h-28 sm:w-28">
          {!imgFailed ? (
            isDataUrl ? (
              <Image
                key={qrKey}
                src={qr.src}
                alt={`Hostel Ghar ${platformMethodLabel(qr.method)} payment QR`}
                className="h-full w-full object-contain p-1"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <Image
                key={qrKey}
                src={qr.src}
                alt={`Hostel Ghar ${platformMethodLabel(qr.method)} payment QR`}
                fill
                sizes="112px"
                className="object-contain p-1"
                onError={() => setImgFailed(true)}
              />
            )
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
              <QrCode className="h-5 w-5 text-neutral-400" aria-hidden />
              <p className="text-[10px] font-medium leading-tight text-neutral-600">
                QR not uploaded
              </p>
              <p className="text-[9px] leading-tight text-neutral-400">
                <span className="font-mono">{qr.method.toLowerCase()}-qr.png</span>
              </p>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 text-left">
          <p className="truncate text-xs font-semibold text-neutral-900 sm:text-[13px]">
            {platformMethodLabel(qr.method)} — {planName}
          </p>
          <p
            className="truncate rounded-md bg-surface-muted px-2 py-1 text-[11px] font-medium text-neutral-700"
            title={qr.label}
          >
            {qr.label}
          </p>
          <p className="text-[11px] leading-snug text-neutral-500">
            {qr.hint} Put hostel name in remarks.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyLabel}
              className="h-7 px-2 text-[11px]"
            >
              {copied ? (
                "Copied"
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </Button>
            {!imgFailed && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={downloadQr}
                className="h-7 px-2 text-[11px]"
              >
                <Download className="h-3 w-3" /> Save QR
              </Button>
            )}
          </div>
        </div>
      </div>
      <ol className="space-y-0.5 border-t border-surface-border bg-surface-muted/60 px-3 py-2 text-[10px] leading-snug text-neutral-600 sm:px-3.5 sm:text-[11px]">
        <li>1. Scan the QR in your {platformMethodLabel(qr.method)} / banking app.</li>
        <li>
          2. Pay exactly{" "}
          <strong>
            {formatCurrency(amount)}
            {cycleLabel}
          </strong>{" "}
          and screenshot success.
        </li>
        <li>3. Upload it in Step 2 — admin activates the plan after verifying.</li>
      </ol>
    </div>
  );
}
