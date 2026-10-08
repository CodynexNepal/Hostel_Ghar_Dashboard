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
 *  3. OR upload from the admin dashboard: `/admin/settings` → Platform QRs.
 *     Admin uploads are stored in localStorage (`hg_platform_qr_*`) and take
 *     precedence over the static files above, so owners see them instantly
 *     on `/subscription` without a redeploy.
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
  /** Where the resolved src came from — for the admin "source" badge. */
  source?: "upload" | "env" | "file";
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

const ENV_SRC_KEY: Record<PlatformQrMethod, string> = {
  ESEWA: "NEXT_PUBLIC_PLATFORM_ESEWA_QR",
  KHALTI: "NEXT_PUBLIC_PLATFORM_KHALTI_QR",
  BANK: "NEXT_PUBLIC_PLATFORM_BANK_QR",
};

const ENV_LABEL_KEY: Record<PlatformQrMethod, string> = {
  ESEWA: "NEXT_PUBLIC_PLATFORM_ESEWA_LABEL",
  KHALTI: "NEXT_PUBLIC_PLATFORM_KHALTI_LABEL",
  BANK: "NEXT_PUBLIC_PLATFORM_BANK_LABEL",
};

const LS_QR_KEY = (m: PlatformQrMethod) => `hg_platform_qr_${m.toLowerCase()}`;
const LS_LABEL_KEY = (m: PlatformQrMethod) => `hg_platform_qr_label_${m.toLowerCase()}`;
export const PLATFORM_QR_EVENT = "platform_qr_changed";
export const PLATFORM_QR_MAX_BYTES = 4 * 1024 * 1024;

function readLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(key);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function getPlatformQr(method: PlatformQrMethod): PlatformQrEntry {
  const uploaded = readLs(LS_QR_KEY(method));
  const uploadedLabel = readLs(LS_LABEL_KEY(method));
  const envSrc = envOr(DEFAULT_SRC[method], ENV_SRC_KEY[method]);
  const envIsCustom = envSrc !== DEFAULT_SRC[method];
  const label = uploadedLabel ?? labelOr(DEFAULT_LABEL[method], ENV_LABEL_KEY[method]);
  if (uploaded) {
    return { method, src: uploaded, label, hint: HINT[method], source: "upload" };
  }
  return { method, src: envSrc, label, hint: HINT[method], source: envIsCustom ? "env" : "file" };
}

export function getPlatformQrs(): PlatformQrEntry[] {
  return PLATFORM_QR_METHODS.map(getPlatformQr);
}

export function platformMethodLabel(method: PlatformQrMethod): string {
  return method === "ESEWA" ? "eSewa" : method === "KHALTI" ? "Khalti" : "Bank";
}

/** Persist an admin-uploaded QR (data-URL) + label. Fires a reactive event. */
export function savePlatformQr(method: PlatformQrMethod, src: string, label: string): void {
  if (typeof window === "undefined") return;
  try {
    if (src) window.localStorage.setItem(LS_QR_KEY(method), src);
    else window.localStorage.removeItem(LS_QR_KEY(method));
    if (label.trim()) window.localStorage.setItem(LS_LABEL_KEY(method), label.trim());
    else window.localStorage.removeItem(LS_LABEL_KEY(method));
    window.dispatchEvent(new CustomEvent(PLATFORM_QR_EVENT, { detail: { method } }));
  } catch {
    throw new Error("Browser storage is full. Try a smaller image (under 2 MB).");
  }
}

/** Remove an admin-uploaded QR, falling back to file/env config. */
export function removePlatformQr(method: PlatformQrMethod): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LS_QR_KEY(method));
    window.localStorage.removeItem(LS_LABEL_KEY(method));
    window.dispatchEvent(new CustomEvent(PLATFORM_QR_EVENT, { detail: { method } }));
  } catch {
    /* noop */
  }
}

/** Read a File as a data-URL (for instant preview + localStorage persist). */
export function fileToPlatformQrDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}
