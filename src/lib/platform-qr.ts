/**
 * Hostel Ghar PLATFORM payment QRs — the official accounts owners pay TO
 * when buying a subscription (BASIC / PRO / ENTERPRISE).
 *
 * This is intentionally separate from `src/lib/payment-qr.ts`, which manages
 * each HOSTEL's own QRs (what residents pay). Platform QRs belong to
 * Hostel Ghar itself, so they live here as static config — no backend
 * change required.
 *
 * How to go live:
 *  1. Drop your real QR images in `public/images/platform/`:
 *       - esewa-qr.png (or .jpg)
 *       - khalti-qr.png
 *       - bank-qr.png   (Fonepay / bank QR)
 *  2. (Optional) override per-deploy via env:
 *       NEXT_PUBLIC_PLATFORM_ESEWA_QR=https://…/esewa.png
 *       NEXT_PUBLIC_PLATFORM_KHALTI_QR=https://…/khalti.png
 *       NEXT_PUBLIC_PLATFORM_BANK_QR=https://…/bank.png
 *       NEXT_PUBLIC_PLATFORM_ESEWA_LABEL="eSewa ID: 98XXXXXXXX • Hostel Ghar"
 *       NEXT_PUBLIC_PLATFORM_KHALTI_LABEL="Khalti ID: 98XXXXXXXX • Hostel Ghar"
 *       NEXT_PUBLIC_PLATFORM_BANK_LABEL="Nabil Bank • A/C 0123456789 • Hostel Ghar Pvt. Ltd."
 *  3. Until real images exist, the UI renders a branded placeholder panel
 *     (never a broken <img>) so owners still see account details + steps.
 */
import type { SubscriptionPaymentMethod } from "@/lib/api-types";

export type PlatformQrMethod = Exclude<SubscriptionPaymentMethod, "CASH">;

export interface PlatformQrEntry {
  method: PlatformQrMethod;
  /** Resolved image src (`/images/platform/…` or env URL). Empty = not configured. */
  src: string;
  /** Human account line shown under the QR (ID / bank A/C). */
  label: string;
  /** Short hint shown in the pay step. */
  hint: string;
}

function envOr(path: string, key: string): string {
  if (typeof process === "undefined") return path;
  const v = (process.env as Record<string, string | undefined>)[key];
  return v && v.trim() ? v.trim() : path;
}

function labelOr(fallback: string, key: string): string {
  if (typeof process === "undefined") return fallback;
  const v = (process.env as Record<string, string | undefined>)[key];
  return v && v.trim() ? v.trim() : fallback;
}

/** Local file convention — replace these files with your real QRs. */
const DEFAULT_SRC: Record<PlatformQrMethod, string> = {
  ESEWA: "/images/platform/esewa-qr.png",
  KHALTI: "/images/platform/khalti-qr.png",
  BANK: "/images/platform/bank-qr.png",
};

const DEFAULT_LABEL: Record<PlatformQrMethod, string> = {
  ESEWA: "eSewa ID: 98XXXXXXXX • Hostel Ghar",
  KHALTI: "Khalti ID: 98XXXXXXXX • Hostel Ghar",
  BANK: "Bank • A/C 01XXXXXXXXXX • Hostel Ghar Pvt. Ltd.",
};

const HINT: Record<PlatformQrMethod, string> = {
  ESEWA: "Open eSewa → Scan QR → enter exact plan amount.",
  KHALTI: "Open Khalti → Scan QR → enter exact plan amount.",
  BANK: "Scan with any mobile banking / Fonepay app.",
};

export const PLATFORM_QR_METHODS: PlatformQrMethod[] = ["ESEWA", "KHALTI", "BANK"];

export function getPlatformQr(method: PlatformQrMethod): PlatformQrEntry {
  const src =
    method === "ESEWA"
      ? envOr(DEFAULT_SRC.ESEWA, "NEXT_PUBLIC_PLATFORM_ESEWA_QR")
      : method === "KHALTI"
        ? envOr(DEFAULT_SRC.KHALTI, "NEXT_PUBLIC_PLATFORM_KHALTI_QR")
        : envOr(DEFAULT_SRC.BANK, "NEXT_PUBLIC_PLATFORM_BANK_QR");
  const label =
    method === "ESEWA"
      ? labelOr(DEFAULT_LABEL.ESEWA, "NEXT_PUBLIC_PLATFORM_ESEWA_LABEL")
      : method === "KHALTI"
        ? labelOr(DEFAULT_LABEL.KHALTI, "NEXT_PUBLIC_PLATFORM_KHALTI_LABEL")
        : labelOr(DEFAULT_LABEL.BANK, "NEXT_PUBLIC_PLATFORM_BANK_LABEL");
  return { method, src, label, hint: HINT[method] };
}

export function getPlatformQrs(): PlatformQrEntry[] {
  return PLATFORM_QR_METHODS.map(getPlatformQr);
}

export function platformMethodLabel(method: PlatformQrMethod): string {
  return method === "ESEWA" ? "eSewa" : method === "KHALTI" ? "Khalti" : "Bank";
}
