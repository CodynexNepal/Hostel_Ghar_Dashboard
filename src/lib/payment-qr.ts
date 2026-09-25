import { useCallback, useEffect, useState } from "react";
import {
  hostelGhar,
  normalizePaymentQrList,
  normalizePaymentQr,
  unwrap,
  validHostelId,
} from "./hostelGhar";
import type { PaymentQr as BackendPaymentQr } from "./api-types";

export type PaymentQrMethod = "ESEWA" | "KHALTI" | "BANK";

export type BackendRole = "RESIDENT" | "OWNER" | "ADMIN" | "HOSTEL_OWNER" | "SUPER_ADMIN";

/** Which backend read endpoint to use for a given viewer role. */
export function paymentQrReadModeForRole(role?: string | null): "resident" | "list" {
  const r = String(role ?? "").toUpperCase();
  // Owner + Admin use the full list; Resident (+ preview callers) use the
  // dedicated resident view. Mirrors paymentQrRouter role matrix.
  if (r.includes("OWNER") || r.includes("ADMIN")) return "list";
  return "resident";
}

export function normalizeQrMethod(raw: unknown): PaymentQrMethod | null {
  const v = String(raw ?? "").toUpperCase();
  if (v.includes("ESEWA")) return "ESEWA";
  if (v.includes("KHALTI")) return "KHALTI";
  if (v.includes("BANK")) return "BANK";
  return null;
}

export function backendQrToMaps(records: BackendPaymentQr[]): {
  qrs: QrMap;
  labels: LabelMap;
  records: BackendPaymentQr[];
} {
  const qrs: QrMap = {};
  const labels: LabelMap = {};
  for (const rec of records) {
    const method = normalizeQrMethod(
      rec.paymentMethod ?? rec.method ?? rec.tag ?? rec.provider
    );
    if (!method) continue;
    const src = String(
      rec.qrCodeUrl ?? rec.imageUrl ?? rec.qrUrl ?? rec.image ?? rec.url ?? ""
    );
    const label = String(
      rec.label ??
        rec.accountLabel ??
        [rec.accountName, rec.accountIdentifier].filter(Boolean).join(
          rec.accountName && rec.accountIdentifier ? " • " : ""
        ) ??
        ""
    );
    // Inactive rows stay hidden from residents (owner still sees them via records).
    const active = rec.isActive ?? (String(rec.status ?? "ACTIVE").toUpperCase() === "ACTIVE");
    if (!active) continue;
    if (src && !qrs[method]) qrs[method] = src;
    if (label && !labels[method]) labels[method] = label;
  }
  return { qrs, labels, records };
}

export interface PaymentMethodMeta {
  value: PaymentQrMethod;
  label: string;
  brandName: string;
  tagline: string;
  brandColor: string;
  brandBg: string;
  hint: string;
  defaultLabel: string;
  sampleAccount: string;
}

export const PAYMENT_METHODS_META: Record<PaymentQrMethod, PaymentMethodMeta> = {
  ESEWA: {
    value: "ESEWA",
    label: "eSewa",
    brandName: "eSewa Mobile Wallet",
    tagline: "Scan & Pay via eSewa App",
    brandColor: "#60bb46",
    brandBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    hint: "Upload your eSewa merchant or personal QR code",
    defaultLabel: "eSewa ID: 9841000001 • Sunrise Hostel",
    sampleAccount: "9841000001",
  },
  KHALTI: {
    value: "KHALTI",
    label: "Khalti",
    brandName: "Khalti Digital Wallet",
    tagline: "Scan & Pay via Khalti App",
    brandColor: "#5c2d91",
    brandBg: "bg-purple-50 text-purple-700 border-purple-200",
    hint: "Upload your Khalti merchant or personal QR code",
    defaultLabel: "Khalti ID: 9841000001 • Sunrise Hostel",
    sampleAccount: "9841000001",
  },
  BANK: {
    value: "BANK",
    label: "Bank Transfer",
    brandName: "Bank / Fonepay QR",
    tagline: "Scan with any Mobile Banking App",
    brandColor: "#1d4ed8",
    brandBg: "bg-blue-50 text-blue-700 border-blue-200",
    hint: "Upload your Fonepay / Bank Account QR code",
    defaultLabel: "Nabil Bank • A/C: 01201017500123 • Sunrise Hostel",
    sampleAccount: "01201017500123",
  },
};

export const PAYMENT_QR_METHODS: { value: PaymentQrMethod; label: string; hint: string }[] = [
  { value: "ESEWA", label: "eSewa", hint: "Upload your eSewa merchant or personal QR" },
  { value: "KHALTI", label: "Khalti", hint: "Upload your Khalti merchant QR" },
  { value: "BANK", label: "Bank", hint: "Upload your bank / Fonepay account QR" },
];

export type QrMap = Partial<Record<PaymentQrMethod, string>>;
export type LabelMap = Partial<Record<PaymentQrMethod, string>>;

function key(hostelId: string) {
  return `hg_payment_qr_${hostelId}`;
}

function labelKey(hostelId: string) {
  return `hg_payment_qr_labels_${hostelId}`;
}

function readJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Load owner's QRs for one hostel (localStorage; backend-ready shape). */
export function loadPaymentQrs(hostelId?: string | null): {
  qrs: QrMap;
  labels: LabelMap;
} {
  if (typeof window === "undefined") return { qrs: {}, labels: {} };
  try {
    let qrs: QrMap = {};
    let labels: LabelMap = {};

    if (hostelId) {
      qrs = readJson<QrMap>(window.localStorage.getItem(key(hostelId))) ?? {};
      labels = readJson<LabelMap>(window.localStorage.getItem(labelKey(hostelId))) ?? {};
    }

    // If specific hostel has no QRs, fall back to global default storage
    if (!qrs.ESEWA && !qrs.KHALTI && !qrs.BANK) {
      const fallbackQrs = readJson<QrMap>(window.localStorage.getItem("hg_payment_qr_default"));
      const fallbackLabels = readJson<LabelMap>(
        window.localStorage.getItem("hg_payment_qr_labels_default")
      );
      if (fallbackQrs && (fallbackQrs.ESEWA || fallbackQrs.KHALTI || fallbackQrs.BANK)) {
        qrs = { ...fallbackQrs, ...qrs };
        labels = { ...fallbackLabels, ...labels };
      }
    }

    return { qrs, labels };
  } catch {
    return { qrs: {}, labels: {} };
  }
}

/** Persist owner's QRs for one hostel. Values are data-URLs (compressed uploads). */
export function savePaymentQrs(
  hostelId: string,
  qrs: QrMap,
  labels: LabelMap
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(hostelId), JSON.stringify(qrs));
    window.localStorage.setItem(labelKey(hostelId), JSON.stringify(labels));
    // Also save to default so resident / demo sessions always see active QRs
    window.localStorage.setItem("hg_payment_qr_default", JSON.stringify(qrs));
    window.localStorage.setItem("hg_payment_qr_labels_default", JSON.stringify(labels));
    // Dispatch reactive event for components in same window
    window.dispatchEvent(
      new CustomEvent("payment_qr_changed", { detail: { hostelId, qrs, labels } })
    );
  } catch {
    /* quota full — caller toasts */
  }
}

/** React hook for reactive payment QRs (localStorage cache + backend sync). */
export function usePaymentQrs(
  hostelId?: string | null,
  opts?: { role?: string | null; mode?: "resident" | "list" | "preview"; enabled?: boolean }
) {
  const [data, setData] = useState<{ qrs: QrMap; labels: LabelMap }>(() =>
    loadPaymentQrs(hostelId)
  );
  const [records, setRecords] = useState<BackendPaymentQr[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  const mode = opts?.mode ?? paymentQrReadModeForRole(opts?.role);
  const enabled = opts?.enabled ?? true;

  const refreshLocal = useCallback(() => {
    setData(loadPaymentQrs(hostelId));
  }, [hostelId]);

  const refresh = useCallback(async () => {
    refreshLocal();
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      // Omit hostelId unless it's a real UUID — the backend parses it as a
      // Postgres uuid and throws on "default"/junk. When omitted it resolves
      // the hostel from auth context / the X-Hostel-Id header, which axios
      // already sends from the `hg_hostel_id` cookie on every request.
      const params = validHostelId(hostelId) ? { hostelId: validHostelId(hostelId) as string } : undefined;
      const res =
        mode === "preview"
          ? await hostelGhar.paymentQrs.preview(params)
          : mode === "list"
            ? await hostelGhar.paymentQrs.list(params)
            : await hostelGhar.paymentQrs.residentView(params);
      const list = normalizePaymentQrList(unwrap<unknown>(res.data));
      const mapped = backendQrToMaps(list);
      // Backend wins when it returns rows; empty backend falls back to cache
      // so owners never lose unsynced uploads and residents still see QRs.
      if (mapped.records.length > 0) {
        setRecords(mapped.records.map((r) => normalizePaymentQr(r)));
        setData((prev) => ({
          qrs: { ...prev.qrs, ...mapped.qrs },
          labels: { ...prev.labels, ...mapped.labels },
        }));
      }
      setBackendAvailable(true);
    } catch (e) {
      // Backend not mounted yet / offline → stay on localStorage cache.
      const msg = e instanceof Error ? e.message : "Couldn't reach payment-QR API.";
      setError(msg);
      setBackendAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, hostelId, mode, refreshLocal]);

  useEffect(() => {
    refreshLocal();
    const handleUpdate = () => refreshLocal();
    window.addEventListener("payment_qr_changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("payment_qr_changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [hostelId, refreshLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...data, records, isLoading, error, backendAvailable, refresh };
}

/** Owner hook: full CRUD against all 10 paymentQrRouter endpoints. */
export function useOwnerPaymentQrs(hostelId?: string | null) {
  const base = usePaymentQrs(hostelId, { mode: "list" });
  const [mutating, setMutating] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setMutating(true);
      try {
        const res = await fn();
        await base.refresh();
        return unwrap<unknown>(res);
      } finally {
        setMutating(false);
      }
    },
    [base]
  );

  return {
    ...base,
    mutating,
    loadDemo: (extra?: { hostelName?: string }) =>
      run(() => {
        const hid = validHostelId(hostelId);
        return hostelGhar.paymentQrs.loadDemo({
          ...(hid ? { hostelId: hid } : {}),
          ...extra,
        });
      }),
    previewResidentView: (params?: { hostelId?: string }) => {
      const hid = validHostelId(params?.hostelId ?? hostelId);
      return hostelGhar.paymentQrs
        .preview(hid ? { hostelId: hid } : undefined)
        .then((r) => normalizePaymentQrList(unwrap<unknown>(r.data)));
    },
    getById: (id: string) =>
      hostelGhar.paymentQrs.detail(id).then((r) => normalizePaymentQr(unwrap<unknown>(r.data))),
    createQr: (payload: Omit<import("./api-types").CreatePaymentQrPayload, "hostelId"> & { hostelId?: string }) =>
      run(() => {
        const hid = validHostelId(payload.hostelId ?? hostelId);
        return hostelGhar.paymentQrs.create({
          ...payload,
          ...(hid ? { hostelId: hid } : { hostelId: undefined }),
        });
      }),
    replaceQr: (id: string, payload: import("./api-types").UpdatePaymentQrPayload) =>
      run(() => hostelGhar.paymentQrs.replace(id, payload)),
    patchQr: (id: string, payload: import("./api-types").PatchPaymentQrPayload) =>
      run(() => hostelGhar.paymentQrs.patch(id, payload)),
    toggleQr: (id: string) => run(() => hostelGhar.paymentQrs.toggleStatus(id)),
    deleteQr: (id: string) => run(() => hostelGhar.paymentQrs.remove(id)),
  };
}

/** Downscale an uploaded QR to max 800px JPEG data-URL so localStorage stays small. */
export function fileToQrDataUrl(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    img.src = url;
  });
}

/** Download a data URL as a file */
export function downloadQrDataUrl(dataUrl: string, filename: string): void {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Generate a realistic, beautifully branded SVG QR Data URL for demo / fallback */
export function generateBrandedDemoQr(method: PaymentQrMethod, hostelName = "Hostel Ghar"): string {
  const meta = PAYMENT_METHODS_META[method];
  const color = meta.brandColor;

  // Authentic QR finder patterns and modules
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
    <defs>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.1"/>
      </filter>
    </defs>
    <!-- Background -->
    <rect width="320" height="320" rx="16" fill="#ffffff"/>
    <rect x="12" y="12" width="296" height="296" rx="12" fill="#fafafa" stroke="#f0f0f0" stroke-width="2"/>
    
    <!-- Top Brand Bar -->
    <rect x="24" y="24" width="272" height="28" rx="6" fill="${color}"/>
    <text x="160" y="43" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1">SCAN TO PAY WITH ${meta.label.toUpperCase()}</text>
    
    <!-- QR Finder Pattern Top-Left -->
    <rect x="36" y="68" width="56" height="56" rx="8" fill="#111827"/>
    <rect x="44" y="76" width="40" height="40" rx="4" fill="#ffffff"/>
    <rect x="52" y="84" width="24" height="24" rx="3" fill="${color}"/>

    <!-- QR Finder Pattern Top-Right -->
    <rect x="228" y="68" width="56" height="56" rx="8" fill="#111827"/>
    <rect x="236" y="76" width="40" height="40" rx="4" fill="#ffffff"/>
    <rect x="244" y="84" width="24" height="24" rx="3" fill="${color}"/>

    <!-- QR Finder Pattern Bottom-Left -->
    <rect x="36" y="224" width="56" height="56" rx="8" fill="#111827"/>
    <rect x="44" y="232" width="40" height="40" rx="4" fill="#ffffff"/>
    <rect x="52" y="240" width="24" height="24" rx="3" fill="${color}"/>

    <!-- QR Alignment Pattern -->
    <rect x="236" y="232" width="36" height="36" rx="4" fill="#111827"/>
    <rect x="244" y="240" width="20" height="20" rx="2" fill="#ffffff"/>
    <rect x="250" y="246" width="8" height="8" rx="1" fill="${color}"/>

    <!-- Data matrix dots and modules -->
    <g fill="#1f2937">
      <!-- Timing horizontal & vertical -->
      <circle cx="106" cy="96" r="4"/><circle cx="122" cy="96" r="4"/><circle cx="138" cy="96" r="4"/>
      <circle cx="182" cy="96" r="4"/><circle cx="198" cy="96" r="4"/><circle cx="214" cy="96" r="4"/>
      <circle cx="64" cy="138" r="4"/><circle cx="64" cy="154" r="4"/><circle cx="64" cy="170" r="4"/>
      <circle cx="64" cy="186" r="4"/><circle cx="64" cy="202" r="4"/>

      <!-- Dot clusters -->
      <circle cx="106" cy="74" r="4"/><circle cx="122" cy="74" r="4"/><circle cx="150" cy="74" r="4"/><circle cx="178" cy="74" r="4"/><circle cx="206" cy="74" r="4"/>
      <circle cx="106" cy="116" r="4"/><circle cx="134" cy="116" r="4"/><circle cx="162" cy="116" r="4"/><circle cx="190" cy="116" r="4"/><circle cx="218" cy="116" r="4"/>
      
      <circle cx="82" cy="138" r="4"/><circle cx="110" cy="138" r="4"/><circle cx="210" cy="138" r="4"/><circle cx="238" cy="138" r="4"/><circle cx="266" cy="138" r="4"/>
      <circle cx="98" cy="154" r="4"/><circle cx="226" cy="154" r="4"/><circle cx="254" cy="154" r="4"/><circle cx="274" cy="154" r="4"/>
      <circle cx="82" cy="170" r="4"/><circle cx="110" cy="170" r="4"/><circle cx="210" cy="170" r="4"/><circle cx="238" cy="170" r="4"/>
      <circle cx="98" cy="186" r="4"/><circle cx="126" cy="186" r="4"/><circle cx="194" cy="186" r="4"/><circle cx="226" cy="186" r="4"/><circle cx="262" cy="186" r="4"/>
      <circle cx="82" cy="202" r="4"/><circle cx="110" cy="202" r="4"/><circle cx="138" cy="202" r="4"/><circle cx="174" cy="202" r="4"/><circle cx="202" cy="202" r="4"/><circle cx="246" cy="202" r="4"/>
      
      <circle cx="106" cy="226" r="4"/><circle cx="134" cy="226" r="4"/><circle cx="162" cy="226" r="4"/><circle cx="190" cy="226" r="4"/>
      <circle cx="118" cy="246" r="4"/><circle cx="146" cy="246" r="4"/><circle cx="174" cy="246" r="4"/><circle cx="202" cy="246" r="4"/>
      <circle cx="106" cy="266" r="4"/><circle cx="134" cy="266" r="4"/><circle cx="162" cy="266" r="4"/><circle cx="190" cy="266" r="4"/>
    </g>

    <!-- Center Logo Badge -->
    <rect x="124" y="128" width="72" height="52" rx="10" fill="#ffffff" stroke="${color}" stroke-width="3" filter="url(#shadow)"/>
    <rect x="129" y="133" width="62" height="42" rx="7" fill="${color}"/>
    <text x="160" y="159" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${meta.label}</text>

    <!-- Bottom Host Name Tag -->
    <text x="160" y="295" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#6b7280" text-anchor="middle">${hostelName}</text>
  </svg>`;

  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Get ready-made default demo QRs */
export function getDemoPaymentQrs(hostelName = "Sunrise Boys Hostel"): {
  qrs: QrMap;
  labels: LabelMap;
} {
  return {
    qrs: {
      ESEWA: generateBrandedDemoQr("ESEWA", hostelName),
      KHALTI: generateBrandedDemoQr("KHALTI", hostelName),
      BANK: generateBrandedDemoQr("BANK", hostelName),
    },
    labels: {
      ESEWA: PAYMENT_METHODS_META.ESEWA.defaultLabel,
      KHALTI: PAYMENT_METHODS_META.KHALTI.defaultLabel,
      BANK: PAYMENT_METHODS_META.BANK.defaultLabel,
    },
  };
}
