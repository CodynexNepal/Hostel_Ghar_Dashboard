"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Eye, ImagePlus, QrCode, Trash2, Upload } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import {
  PLATFORM_QR_EVENT,
  PLATFORM_QR_MAX_BYTES,
  PLATFORM_QR_METHODS,
  fileToPlatformQrDataUrl,
  getPlatformQr,
  platformMethodLabel,
  type PlatformQrEntry,
  type PlatformQrMethod,
} from "@/lib/platform-qr";

const METHOD_ACCENT: Record<PlatformQrMethod, string> = {
  ESEWA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  KHALTI: "bg-purple-50 text-purple-700 border-purple-200",
  BANK: "bg-blue-50 text-blue-700 border-blue-200",
};

function SourceBadge({ entry }: { entry: PlatformQrEntry }) {
  if (entry.source === "backend") {
    return (
      <Badge tone="green">
        <CheckCircle2 className="h-3 w-3" /> Live — published
      </Badge>
    );
  }
  if (entry.source === "env") return <Badge tone="blue">Live — env URL</Badge>;
  return <Badge tone="amber">Placeholder — upload QR</Badge>;
}

function QrPreview({ entry }: { entry: PlatformQrEntry }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [entry.src]);
  const isDataUrl = entry.src.startsWith("data:");
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
        <QrCode className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-[11px] font-medium text-neutral-500">Image missing at</p>
        <p className="break-all font-mono text-[10px] text-neutral-400">{entry.src}</p>
      </div>
    );
  }
  if (isDataUrl) {
    return (
      <Image
        priority
        fill
        sizes="160px"
        src={entry.src}
        alt=""
        className="h-full w-full object-contain p-1.5"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <Image
      src={entry.src}
      alt={`Hostel Ghar ${platformMethodLabel(entry.method)} QR preview`}
      fill
      sizes="160px"
      className="object-contain p-1.5"
      onError={() => setFailed(true)}
    />
  );
}

function QrCard({
  entry,
  label,
  onLabel,
  draft,
  err,
  saving,
  inputRef,
  onPick,
  onFile,
  onSave,
  onRemove,
  removing,
}: {
  entry: PlatformQrEntry;
  label: string;
  onLabel: (v: string) => void;
  draft?: string;
  err?: string;
  saving: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onPick: () => void;
  onFile: (f?: File | null) => void;
  onSave: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const method = entry.method;
  const previewSrc = draft ?? entry.src;
  const preview: PlatformQrEntry = { ...entry, src: previewSrc };
  const dirty = Boolean(draft) || label.trim() !== entry.label.trim();
  return (
    <div className="overflow-hidden rounded-xl border border-surface-border">
      <div
        className={`flex items-center justify-between border-b px-3 py-2 ${METHOD_ACCENT[method]}`}
      >
        <p className="text-[13px] font-bold">{platformMethodLabel(method)}</p>
        <SourceBadge entry={entry} />
      </div>
      <div className="bg-white p-3">
        <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-lg border border-surface-border bg-surface-muted">
          <QrPreview entry={preview} />
          {draft && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-ink px-2 py-0.5 text-[10px] font-semibold text-white">
              New — not saved
            </span>
          )}
        </div>
        <div className="mt-3">
          <Input
            id={`platform-qr-label-${method.toLowerCase()}`}
            label="Account label (shown under QR)"
            placeholder={entry.label}
            value={label}
            onChange={(e) => onLabel(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            e.g. eSewa ID: 98XXXXXXXX • Hostel Ghar
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={`Upload ${platformMethodLabel(method)} QR`}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {err && (
          <p role="alert" className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
            {err}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50/60 px-3 py-2.5">
        <Button size="sm" variant="outline" onClick={onPick} className="gap-1.5 text-xs">
          {previewSrc && entry.source === "backend" && !draft ? (
            <span className="flex items-center gap-1.5">
              <ImagePlus className="h-3.5 w-3.5" /> Replace
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" /> {previewSrc ? "Replace" : "Upload QR"}
            </span>
          )}
        </Button>
        <div className="flex items-center gap-1.5">
          {dirty && (
            <Button size="sm" onClick={onSave} loading={saving} disabled={removing} className="text-xs">
              Save
            </Button>
          )}
          {entry.source === "backend" && !draft && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRemove}
              loading={removing}
              disabled={saving}
              className="gap-1 px-2 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
      <p className="flex items-center gap-1.5 border-t border-surface-border bg-surface-muted/50 px-3 py-2 text-[10px] text-neutral-500">
        <Eye className="h-3 w-3 shrink-0" /> Owner checkout preview — /subscription →{" "}
        {platformMethodLabel(method)}
      </p>
    </div>
  );
}

export function PlatformQrUploadForm() {
  const { success, error: toastError } = useToast();
  const backend = usePlatformSettings();
  const [labels, setLabels] = useState<Record<PlatformQrMethod, string>>({
    ESEWA: getPlatformQr("ESEWA").label,
    KHALTI: getPlatformQr("KHALTI").label,
    BANK: getPlatformQr("BANK").label,
  });
  const [draftSrc, setDraftSrc] = useState<Partial<Record<PlatformQrMethod, string>>>({});
  const [errs, setErrs] = useState<Partial<Record<PlatformQrMethod, string>>>({});
  const [saving, setSaving] = useState<PlatformQrMethod | null>(null);
  const [removing, setRemoving] = useState<PlatformQrMethod | null>(null);
  const [version, setVersion] = useState(0);
  const fileRefs = useRef<Record<PlatformQrMethod, HTMLInputElement | null>>({
    ESEWA: null,
    KHALTI: null,
    BANK: null,
  });
  void version;

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    setDraftSrc({});
    setLabels({
      ESEWA: getPlatformQr("ESEWA").label,
      KHALTI: getPlatformQr("KHALTI").label,
      BANK: getPlatformQr("BANK").label,
    });
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(PLATFORM_QR_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PLATFORM_QR_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  async function handleFile(method: PlatformQrMethod, file?: File | null) {
    setErrs((p) => ({ ...p, [method]: undefined }));
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrs((p) => ({ ...p, [method]: "Please choose an image file (JPG / PNG / WEBP)." }));
      return;
    }
    if (file.size > PLATFORM_QR_MAX_BYTES) {
      setErrs((p) => ({ ...p, [method]: "Image must be under 4 MB." }));
      return;
    }
    try {
      const url = await fileToPlatformQrDataUrl(file);
      setDraftSrc((p) => ({ ...p, [method]: url }));
    } catch (e) {
      setErrs((p) => ({ ...p, [method]: e instanceof Error ? e.message : "Couldn't read image." }));
    }
  }

  async function handleSave(method: PlatformQrMethod, entry: PlatformQrEntry) {
    if (saving || removing) return; // ignore double-submit while a request is in flight
    const src = draftSrc[method] ?? entry.src;
    const label = (labels[method] ?? "").trim();
    if (!src) {
      setErrs((p) => ({ ...p, [method]: "Upload a QR image first." }));
      return;
    }
    if (!label) {
      setErrs((p) => ({ ...p, [method]: "Add the account label owners see under the QR." }));
      return;
    }
    // Keep the picked File so we can multipart-upload to the backend.
    const pickedInput = fileRefs.current[method];
    const pickedFile = pickedInput?.files?.[0] ?? null;
    setSaving(method);
    // Database is the ONLY source of truth: POST/PUT /admin/platform-qrs
    // (multipart file wins, else JSON url). No localStorage fallback — a failed
    // save must surface as an error, never a silent per-browser "success" that
    // owners on other devices would never see.
    try {
      const br = await backend.upsertQr(method, pickedFile, label, src);
      if (!br.ok) {
        setErrs((p) => ({ ...p, [method]: br.message }));
        toastError(`Couldn't save ${platformMethodLabel(method)} QR`, br.message);
        return;
      }
      setErrs((p) => ({ ...p, [method]: undefined }));
      success(`${platformMethodLabel(method)} QR published`, "Owners now see it on the Subscription page.");
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save. Try again.";
      setErrs((p) => ({ ...p, [method]: msg }));
      toastError(`Couldn't save ${platformMethodLabel(method)} QR`, msg);
    } finally {
      setSaving(null);
    }
  }

  async function handleRemove(method: PlatformQrMethod) {
    if (saving || removing) return; // ignore double-submit while a request is in flight
    setRemoving(method);
    try {
      // Delete the DB/Cloudinary row. There is no local copy to clear.
      const br = await backend.removeQr(method);
      if (!br.ok) {
        toastError(`Couldn't remove ${platformMethodLabel(method)} QR`, br.message);
        return;
      }
      success(`${platformMethodLabel(method)} QR removed`, "Owners fall back to file / env config.");
      refresh();
    } catch (e) {
      toastError("Couldn't remove QR", e instanceof Error ? e.message : "Try again.");
    } finally {
      setRemoving(null);
    }
  }

  const entries: PlatformQrEntry[] = PLATFORM_QR_METHODS.map(getPlatformQr);
  return (
    <Card>
      <CardHeader
        title="Platform payment QRs"
        subtitle="What hostel owners scan on the Subscription page when they pay you. Upload once — owners see it instantly."
      />
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
        {entries.map((entry) => (
          <QrCard
            key={entry.method}
            entry={entry}
            label={labels[entry.method] ?? ""}
            onLabel={(v) => setLabels((p) => ({ ...p, [entry.method]: v }))}
            draft={draftSrc[entry.method]}
            err={errs[entry.method]}
            saving={saving === entry.method}
            removing={removing === entry.method}
            inputRef={(el) => {
              fileRefs.current[entry.method] = el;
            }}
            onPick={() => fileRefs.current[entry.method]?.click()}
            onFile={(f) => void handleFile(entry.method, f)}
            onSave={() => handleSave(entry.method, entry)}
            onRemove={() => handleRemove(entry.method)}
          />
        ))}
      </div>
      <p className="border-t border-surface-border px-4 py-3 text-xs text-neutral-500 sm:px-5">
        JPG / PNG / WEBP up to 4 MB per QR. Saving uploads the QR to the platform database, so
        owners on every device see it immediately on <span className="font-mono">/subscription</span>.
        If the save fails you&apos;ll see an error — nothing is stored only in your browser, so the
        database is the single source of truth.
      </p>
    </Card>
  );
}
