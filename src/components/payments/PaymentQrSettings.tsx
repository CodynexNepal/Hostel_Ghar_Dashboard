"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  QrCode,
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  Sparkles,
  Smartphone,
  CreditCard,
  Building,
  Info,
  Power,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId, toApiError } from "@/lib/axios";
import {
  hostelGhar,
  normalizePaymentQr,
  normalizePaymentQrList,
  splitAccountLabel,
  toPaginated,
  unwrap,
} from "@/lib/hostelGhar";
import type { HostelDetail, PaymentQr as BackendPaymentQr } from "@/lib/api-types";
import {
  PAYMENT_METHODS_META,
  PAYMENT_QR_METHODS,
  backendQrToMaps,
  fileToQrDataUrl,
  getDemoPaymentQrs,
  loadPaymentQrs,
  normalizeQrMethod,
  savePaymentQrs,
  usePaymentQrs,
  type LabelMap,
  type PaymentQrMethod,
  type QrMap,
} from "@/lib/payment-qr";
import { PaymentQrDialog } from "./PaymentQrDialog";

async function resolveHostelId(preferred?: string | null): Promise<string | null> {
  if (preferred && preferred.toLowerCase() !== "default") return preferred;
  const fromCookie = getHostelId();
  // The hg_hostel_id cookie is the source of truth — but never accept the
  // "default" sentinel or non-UUID junk (backend parses hostelId as uuid).
  if (fromCookie && fromCookie.toLowerCase() !== "default") return fromCookie;
  try {
    const list = await hostelGhar.hostels.list({ limit: 1 });
    return toPaginated<HostelDetail>(list.data).items[0]?.id ?? null;
  } catch {
    return null;
  }
}

export function PaymentQrSettings() {
  const { success, error: toastError } = useToast();
  const { user, role } = useAuth();
  const manager = String(role ?? "").toUpperCase().includes("OWNER") ||
    String(role ?? "").toUpperCase().includes("ADMIN");
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [qrs, setQrs] = useState<QrMap>({});
  const [labels, setLabels] = useState<LabelMap>({});
  const [records, setRecords] = useState<BackendPaymentQr[]>([]);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState<PaymentQrMethod | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [previewMethod, setPreviewMethod] = useState<PaymentQrMethod | null>(null);
  const [isDragging, setIsDragging] = useState<PaymentQrMethod | null>(null);

  const fileRefs = useRef<Record<PaymentQrMethod, HTMLInputElement | null>>({
    ESEWA: null,
    KHALTI: null,
    BANK: null,
  });

  useEffect(() => {
    let cancelled = false;
    void resolveHostelId(user?.hostelId).then((hid) => {
      if (cancelled) return;
      // hid is a real UUID or null (cookie `hg_hostel_id` is the source of
      // truth). null = unresolved → backend resolves via auth/X-Hostel-Id.
      setHostelId(hid);
      const stored = loadPaymentQrs(hid);
      setQrs(stored.qrs);
      setLabels(stored.labels);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.hostelId]);

  // Live backend list (endpoint 1 GET /) merged over localStorage cache.
  // No hostelId → param omitted → backend resolves from X-Hostel-Id/auth.
  const live = usePaymentQrs(hostelId, { mode: "list" });

  useEffect(() => {
    setQrs(live.qrs);
    setLabels(live.labels);
    if (live.records.length > 0) {
      setRecords(live.records);
      setBackendAvailable(true);
    } else if (live.backendAvailable) {
      setRecords([]);
      setBackendAvailable(true);
    } else if (live.error) {
      setBackendAvailable(false);
    }
  }, [live.qrs, live.labels, live.records, live.backendAvailable, live.error]);

  const recordByMethod = useMemo(() => {
    const map = new Map<PaymentQrMethod, BackendPaymentQr>();
    for (const rec of records) {
      const m = normalizeQrMethod(rec.paymentMethod ?? rec.method ?? rec.tag ?? rec.provider);
      if (m && !map.has(m)) map.set(m, rec);
    }
    return map;
  }, [records]);

  function persistLocal(nextQrs: QrMap, nextLabels: LabelMap) {
    setQrs(nextQrs);
    setLabels(nextLabels);
    savePaymentQrs(hostelId ?? "default", nextQrs, nextLabels);
  }

  async function handleFile(method: PaymentQrMethod, file: File | undefined) {
    if (!file) return;
    if (!manager) {
      toastError("Read-only", "Only owners/admins can upload payment QRs.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toastError("Invalid format", "Please upload a PNG, JPG, or WebP QR code image.");
      return;
    }
    // Backend requires accountName + accountIdentifier — derive from the label
    // field when the user typed a combined "Bank • A/C …" string.
    const split = splitAccountLabel(
      labels[method] ?? "",
      user?.hostelName || "Sunrise Boys Hostel"
    );
    if (!split.accountName.trim() || !split.accountIdentifier.trim()) {
      toastError(
        "Account details required",
        "Enter the account name and number/ID first (e.g. account name + eSewa phone or bank A/C), then upload the QR."
      );
      return;
    }
    setSaving(method);
    try {
      const existing = recordByMethod.get(method);
      if (backendAvailable || existing) {
        try {
          const hostelName = user?.hostelName || "Sunrise Boys Hostel";
          const body = {
            // Omitted unless a real UUID: backend falls back to auth/X-Hostel-Id.
            hostelId: hostelId ?? undefined,
            method,
            accountName: split.accountName,
            accountIdentifier: split.accountIdentifier,
            file,
          };
          if (existing) {
            await hostelGhar.paymentQrs.replace(existing.id, body, { hostelName });
          } else {
            await hostelGhar.paymentQrs.create(body, { hostelName });
          }
          await live.refresh();
          success(
            `${PAYMENT_METHODS_META[method].label} QR Saved`,
            existing ? "QR replaced — residents see the new code." : "Residents can now view and scan this QR code."
          );
          return;
        } catch (err) {
          const status = toApiError(err).status;
          if (status !== 404 && status !== 0) throw err;
          setBackendAvailable(false);
        }
      }
      const dataUrl = await fileToQrDataUrl(file);
      persistLocal({ ...qrs, [method]: dataUrl }, labels);
      success(`${PAYMENT_METHODS_META[method].label} QR Saved`, "Residents can now view and scan this QR code.");
    } catch (err) {
      toastError("Upload failed", toApiError(err).message);
    } finally {
      setSaving(null);
    }
  }

  async function handleRemove(method: PaymentQrMethod) {
    if (!manager) {
      toastError("Read-only", "Only owners/admins can remove payment QRs.");
      return;
    }
    const existing = recordByMethod.get(method);
    if (existing && backendAvailable) {
      try {
        await hostelGhar.paymentQrs.remove(existing.id);
        await live.refresh();
        success("QR Removed", `${PAYMENT_METHODS_META[method].label} QR is no longer visible to residents.`);
        return;
      } catch (err) {
        toastError("Remove failed", toApiError(err).message);
        return;
      }
    }
    const nextQrs = { ...qrs };
    delete nextQrs[method];
    persistLocal(nextQrs, labels);
    success("QR Removed", `${PAYMENT_METHODS_META[method].label} QR is no longer visible to residents.`);
  }

  function handleLabelChange(method: PaymentQrMethod, value: string) {
    const nextLabels = { ...labels, [method]: value };
    setLabels(nextLabels);
    savePaymentQrs(hostelId ?? "default", qrs, nextLabels);
    const existing = recordByMethod.get(method);
    if (existing && backendAvailable && manager) {
      // PATCH accepts partial canonical fields — re-split the edited label.
      const split = splitAccountLabel(value, user?.hostelName || "");
      const patch: Record<string, string> = {};
      if (split.accountName.trim()) patch.accountName = split.accountName;
      if (split.accountIdentifier.trim()) patch.accountIdentifier = split.accountIdentifier;
      if (Object.keys(patch).length > 0) {
        void hostelGhar.paymentQrs.patch(existing.id, patch).catch(() => {});
      }
    }
  }

  async function handlePopulateDemo() {
    if (!manager) {
      toastError("Read-only", "Only owners/admins can load demo QRs.");
      return;
    }
    setLoadingDemo(true);
    try {
      const res = await hostelGhar.paymentQrs.loadDemo({
        hostelId: hostelId ?? undefined,
        hostelName: user?.hostelName || "Sunrise Boys Hostel",
      });
      const list = normalizePaymentQrList(unwrap<unknown>(res.data));
      setBackendAvailable(true);
      if (list.length > 0) {
        const mapped = backendQrToMaps(list);
        persistLocal({ ...qrs, ...mapped.qrs }, { ...labels, ...mapped.labels });
      }
      await live.refresh();
      success("Sample QRs Loaded", "eSewa, Khalti, and Bank sample QRs configured successfully.");
    } catch {
      const demo = getDemoPaymentQrs(user?.hostelName || "Sunrise Boys Hostel");
      persistLocal({ ...demo.qrs }, { ...demo.labels });
      setBackendAvailable(false);
      success("Sample QRs Loaded", "eSewa, Khalti, and Bank sample QRs configured successfully.");
    } finally {
      setLoadingDemo(false);
    }
  }

  async function handleToggle(method: PaymentQrMethod) {
    const existing = recordByMethod.get(method);
    if (!existing || !manager) return;
    try {
      await hostelGhar.paymentQrs.toggleStatus(existing.id);
      await live.refresh();
      success("QR status updated", `${PAYMENT_METHODS_META[method].label} visibility toggled.`);
    } catch (err) {
      toastError("Toggle failed", toApiError(err).message);
    }
  }

  async function handleRefreshList() {
    setLoadingList(true);
    try {
      await live.refresh();
    } finally {
      setLoadingList(false);
    }
  }

  const methodIcons: Record<PaymentQrMethod, React.ReactNode> = {
    ESEWA: <Smartphone className="h-4 w-4 text-emerald-600" />,
    KHALTI: <CreditCard className="h-4 w-4 text-purple-600" />,
    BANK: <Building className="h-4 w-4 text-blue-600" />,
  };

  return (
    <div id="payment-qrs">
      <Card className="overflow-hidden border border-neutral-200/80 shadow-sm">
      <CardHeader
        title="Hostel Payment QR Codes"
        subtitle="Manage eSewa, Khalti, and Bank payment QRs shown to residents when paying monthly fees"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handlePopulateDemo()}
              loading={loadingDemo}
              className="gap-1.5 text-xs text-neutral-700"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Load Demo QRs
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRefreshList()}
              loading={loadingList}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewMethod("ESEWA")}
              className="gap-1.5 text-xs"
            >
              <Eye className="h-3.5 w-3.5" /> Preview Resident View
            </Button>
          </div>
        }
      />

      <div className="border-b border-neutral-100 bg-neutral-50/70 px-5 py-3">
        <p className="flex items-center gap-2 text-xs text-neutral-600">
          <Info className="h-4 w-4 text-brand-ink shrink-0" />
          <span>
            Residents see these QR codes under <strong>My Payments</strong> (GET /resident). After scanning and paying, they can present their transaction reference or screenshot at the desk.
            {!backendAvailable && (
              <> <strong>Backend offline</strong> — showing local cache; uploads sync when the API is reachable.</>
            )}
            {!manager && <> <strong>Read-only</strong> — sign in as owner/admin to manage QRs.</>}
          </span>
        </p>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-3">
        {PAYMENT_QR_METHODS.map((m) => {
          const meta = PAYMENT_METHODS_META[m.value];
          const src = qrs[m.value];
          const labelValue = labels[m.value] ?? "";
          const isCurrentDragging = isDragging === m.value;
          const record = recordByMethod.get(m.value);
          const active = record
            ? (record.isActive ?? String(record.status ?? "ACTIVE").toUpperCase() === "ACTIVE")
            : Boolean(src);

          return (
            <div
              key={m.value}
              className={`relative flex flex-col justify-between rounded-2xl border transition-all ${
                src
                  ? "border-neutral-200/90 bg-white shadow-xs hover:border-neutral-300"
                  : "border-dashed border-neutral-300 bg-neutral-50/50"
              }`}
            >
              <div className="p-4">
                {/* Method Header Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100">
                      {methodIcons[m.value]}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{meta.label}</p>
                      <p className="text-[11px] text-neutral-500">{meta.tagline}</p>
                    </div>
                  </div>
                  {src ? (
                    active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                        Inactive
                      </span>
                    )
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                      Not Added
                    </span>
                  )}
                </div>

                {/* QR Image Area / Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(m.value);
                  }}
                  onDragLeave={() => setIsDragging(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(null);
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile) void handleFile(m.value, droppedFile);
                  }}
                  onClick={() => {
                    if (!src) fileRefs.current[m.value]?.click();
                  }}
                  className={`mt-3.5 flex h-48 flex-col items-center justify-center overflow-hidden rounded-xl border transition-all ${
                    isCurrentDragging
                      ? "border-brand-ink bg-brand/10 ring-2 ring-brand"
                      : src
                        ? "border-neutral-200 bg-neutral-100/50"
                        : "cursor-pointer border-dashed border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
                  }`}
                >
                  {src ? (
                    <div className="group relative flex h-full w-full items-center justify-center p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`${meta.label} QR`}
                        className="h-full w-full object-contain transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white text-neutral-900 hover:bg-neutral-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewMethod(m.value);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" /> Full View
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-4 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
                        <QrCode className="h-6 w-6" />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-neutral-700">
                        Upload {meta.label} QR Code
                      </p>
                      <p className="mt-0.5 text-[11px] text-neutral-400">
                        Click or drag & drop (PNG, JPG)
                      </p>
                    </div>
                  )}
                </div>

                {/* Account Details Inputs — backend requires accountName + accountIdentifier */}
                <div className="mt-3.5 grid gap-2.5">
                  <Input
                    label={
                      m.value === "BANK" ? "Bank / Account Name" : `${meta.label} Account Name`
                    }
                    placeholder={user?.hostelName || "Sunrise Hostel"}
                    value={record?.accountName ?? splitAccountLabel(labelValue, user?.hostelName || "").accountName}
                    onChange={(e) => {
                      const current = splitAccountLabel(
                        labelValue,
                        user?.hostelName || "Sunrise Hostel"
                      );
                      const next = `${e.target.value}${current.accountIdentifier ? ` • ${current.accountIdentifier}` : ""}`;
                      void handleLabelChange(m.value, next);
                    }}
                  />
                  <Input
                    label={
                      m.value === "BANK" ? "Account Number" : `${meta.label} ID / Mobile Number`
                    }
                    placeholder={meta.sampleAccount}
                    value={record?.accountIdentifier ?? splitAccountLabel(labelValue, "").accountIdentifier}
                    onChange={(e) => {
                      const current = splitAccountLabel(
                        labelValue,
                        user?.hostelName || "Sunrise Hostel"
                      );
                      const next = `${current.accountName}${e.target.value ? ` • ${e.target.value}` : ""}`;
                      void handleLabelChange(m.value, next);
                    }}
                  />
                  <p className="text-[11px] text-neutral-400">
                    Shown beneath the QR so residents can verify or copy it
                  </p>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={(el) => {
                    fileRefs.current[m.value] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label={`Upload ${meta.label} QR Code`}
                  onChange={(e) => void handleFile(m.value, e.target.files?.[0])}
                />
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50/50 p-3">
                <Button
                  size="sm"
                  variant={src ? "outline" : "primary"}
                  onClick={() => fileRefs.current[m.value]?.click()}
                  loading={saving === m.value}
                  disabled={!manager}
                  className="gap-1.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" /> {src ? "Replace QR" : "Upload QR"}
                </Button>
                <div className="flex items-center gap-1.5">
                  {record && manager && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleToggle(m.value)}
                      className="gap-1 px-2 text-xs text-neutral-600 hover:bg-neutral-100"
                      title={active ? "Deactivate (hide from residents)" : "Activate (show to residents)"}
                    >
                      <Power className="h-3.5 w-3.5" /> {active ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                  {src && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleRemove(m.value)}
                      disabled={!manager}
                      className="gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Dialog for Owner — GET /preview (resident view as owners see it) */}
      <PaymentQrDialog
        open={Boolean(previewMethod)}
        onClose={() => setPreviewMethod(null)}
        method={previewMethod ?? "ESEWA"}
        mode="preview"
        hostelId={hostelId}
        hostelName={user?.hostelName || "Sunrise Boys Hostel"}
        amountLabel="Rs. 12,000 (Sample Fee)"
        feeDescription="Resident View Preview"
      />
    </Card>
  </div>
  );
}
