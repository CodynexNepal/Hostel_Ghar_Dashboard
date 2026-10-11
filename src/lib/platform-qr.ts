/**
 * Hostel Ghar PLATFORM payment QRs — the official accounts owners pay TO
 * when buying a subscription (BASIC / PRO / ENTERPRISE).
 *
 * This is intentionally separate from `src/lib/payment-qr.ts`, which manages
 * each HOSTEL's own QRs (what residents pay). Platform QRs belong to
 * Hostel Ghar itself.
 *
 * SOURCE OF TRUTH — the backend now persists these to PostgreSQL
 * (`platform_qrs` table, images on Cloudinary) via:
 *   GET  /v1/hostel-ghar/platform-qrs         (owner checkout — active only)
 *   GET  /v1/hostel-ghar/admin/platform-qrs    (admin list)
 *   POST/PUT/DELETE /admin/platform-qrs[/:id]  (admin CRUD)
 * The dashboard feeds the served rows into the backend cache via
 * `setBackendPlatformQrs()` (see `usePlatformCheckoutQrs` for owners and
 * `usePlatformSettings` for admins), so every device shows the same QRs.
 *
 * Resolution order in `getPlatformQr` (highest priority first):
 *   1. backend cache  — the DB/Cloudinary rows served by the API (normal case).
 *   2. env URL        — a per-deploy override via NEXT_PUBLIC_PLATFORM_*_QR.
 *   3. static file    — public/images/platform/*.png shipped with the build.
 *
 * There is deliberately NO localStorage fallback: localStorage is per-browser
 * and per-device, so an admin "save" would only ever appear in that one browser
 * and never reach owners on other devices. If the API is unreachable, the admin
 * UI surfaces a real error instead of faking success — the database is the only
 * source of truth for uploaded QRs.
 *
 * Static-file / env fallbacks (still supported for deploys without the API):
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
  source?: "backend" | "env" | "file";
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

export const PLATFORM_QR_EVENT = "platform_qr_changed";
export const PLATFORM_QR_MAX_BYTES = 4 * 1024 * 1024;

/** Backend QR cache — filled by `setBackendPlatformQrs` (GET /platform-qrs). */
let backendCache: Partial<Record<PlatformQrMethod, { src: string; label: string }>> = {};

function readBackendCache(method: PlatformQrMethod): { src: string; label: string } | null {
  return backendCache[method] ?? null;
}

/**
 * Cache backend QR rows client-side so owner checkout (`PlatformQrPanel`
 * → `getPlatformQr`) serves the DB/Cloudinary URLs. This is the ONLY source
 * of uploaded QRs — there is no per-browser override. No-op on server.
 */
export function setBackendPlatformQrs(
  rows: {
    method?: string;
    qrImageUrl?: string;
    qrCodeUrl?: string;
    imageUrl?: string;
    label?: string;
  }[]
): void {
  if (typeof window === "undefined") return;
  const next: typeof backendCache = {};
  for (const row of rows ?? []) {
    const m = String(row?.method ?? "").toUpperCase();
    if (m !== "ESEWA" && m !== "KHALTI" && m !== "BANK") continue;
    const src = String(row?.qrImageUrl ?? row?.qrCodeUrl ?? row?.imageUrl ?? "").trim();
    if (!src) continue;
    next[m as PlatformQrMethod] = { src, label: String(row?.label ?? "").trim() };
  }
  backendCache = next;
  try {
    window.dispatchEvent(new CustomEvent(PLATFORM_QR_EVENT));
  } catch {
    /* noop */
  }
}

export function getPlatformQr(method: PlatformQrMethod): PlatformQrEntry {
  const envSrc = envOr(DEFAULT_SRC[method], ENV_SRC_KEY[method]);
  const envIsCustom = envSrc !== DEFAULT_SRC[method];
  const label = labelOr(DEFAULT_LABEL[method], ENV_LABEL_KEY[method]);
  // DB/Cloudinary rows (set via `setBackendPlatformQrs` after GET /platform-qrs)
  // are the source of truth for uploaded QRs and win over file/env config.
  const backendEntry = readBackendCache(method);
  if (backendEntry?.src) {
    return {
      method,
      src: backendEntry.src,
      label: backendEntry.label || label,
      hint: HINT[method],
      source: "backend",
    };
  }
  return { method, src: envSrc, label, hint: HINT[method], source: envIsCustom ? "env" : "file" };
}

export function getPlatformQrs(): PlatformQrEntry[] {
  return PLATFORM_QR_METHODS.map(getPlatformQr);
}

export function platformMethodLabel(method: PlatformQrMethod): string {
  return method === "ESEWA" ? "eSewa" : method === "KHALTI" ? "Khalti" : "Bank";
}

/** Read a File as a data-URL for an instant in-form preview before upload. */
export function fileToPlatformQrDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}
