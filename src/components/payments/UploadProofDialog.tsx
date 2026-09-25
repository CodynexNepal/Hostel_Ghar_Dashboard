"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, ImagePlus, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/utils";
import type { Fee } from "@/lib/api-types";
import {
  proofFileToDataUrl,
  proofStatusLabel,
  proofStatusTone,
  uploadPaymentProof,
  type PaymentProof,
  type ProofPaymentMethod,
} from "@/lib/payment-proofs";

const METHOD_OPTIONS: { value: ProofPaymentMethod; label: string }[] = [
  { value: "ESEWA", label: "eSewa" },
  { value: "KHALTI", label: "Khalti" },
  { value: "BANK", label: "Bank transfer" },
  { value: "CASH", label: "Cash (receipt)" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  fee: Fee | null;
  hostelId?: string | null;
  residentId?: string | null;
  residentName?: string;
  residentEmail?: string;
  roomNumber?: string;
  existingProof?: PaymentProof | null;
  onSubmitted?: (proof: PaymentProof) => void;
}
export function UploadProofDialog(p: Props) {
  const { open, onClose, fee } = p;
  const { success, error: toastError } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [method, setMethod] = useState<ProofPaymentMethod>("ESEWA");
  const [txnRef, setTxnRef] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setFile(null); setPreview(""); setTxnRef(""); setRemarks("");
    setFileError(null); setBusy(false);
    const ex = p.existingProof;
    setMethod(ex && ex.status === "PENDING" ? ex.method : "ESEWA");
    if (ex && ex.status === "PENDING") {
      setTxnRef(ex.transactionRef ?? ""); setRemarks(ex.remarks ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);
  if (!fee) return null;
  const amount = Number(fee.totalPayable ?? fee.amount) || 0;
  const feeLabel = fee.month ?? "Current bill";
  async function pick(f?: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setFileError("Choose PNG/JPG image."); return; }
    setFileError(null); setFile(f);
    try { setPreview(await proofFileToDataUrl(f)); }
    catch (e) { setFile(null); setFileError(e instanceof Error ? e.message : "Bad image."); }
  }

  async function submit() {
    if (!fee) return;
    if (!file || !preview) { setFileError("Upload screenshot first."); return; }
    setBusy(true);
    try {
      const proof = await uploadPaymentProof({
        feeId: String(fee.id), hostelId: p.hostelId ?? null,
        residentId: p.residentId ?? null, residentName: p.residentName,
        residentEmail: p.residentEmail, roomNumber: p.roomNumber,
        feeLabel, amount, method,
        transactionRef: txnRef.trim() || undefined,
        remarks: remarks.trim() || undefined,
        file, imageUrl: preview,
      });
      success("Receipt submitted", "Owner will review and mark fee paid.");
      p.onSubmitted?.(proof); onClose();
    } catch (e) { toastError("Submit failed", e instanceof Error ? e.message : "Retry."); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Upload payment receipt"
      description={`Proof for ${feeLabel} · ${formatCurrency(amount)}`}>
      <div className="space-y-4">
        {p.existingProof && (
          <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-xs">
            <span className="text-neutral-600">Current status</span>
            <Badge tone={proofStatusTone(p.existingProof.status)}>{proofStatusLabel(p.existingProof.status)}</Badge>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Screenshot <span className="text-red-600">*</span></p>
          {preview ? (
            <div className="relative overflow-hidden rounded-xl border border-surface-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Receipt" className="max-h-64 w-full bg-neutral-50 object-contain" />
              <button type="button" aria-label="Remove" onClick={() => { setFile(null); setPreview(""); }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-surface-border bg-neutral-50/60 px-4 py-8 hover:border-brand-ink">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
                <ImagePlus className="h-5 w-5 text-brand-ink" />
              </span>
              <span className="text-sm font-semibold">Tap to upload screenshot</span>
              <span className="text-xs text-neutral-500">eSewa/Khalti screen or bank receipt · under 4MB</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Screenshot"
            onChange={(e) => void pick(e.target.files?.[0])} />
          {fileError && <p role="alert" className="mt-1.5 text-xs text-red-600">{fileError}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="proof-m" className="mb-1.5 block text-[13px] font-medium">Paid via *</label>
            <select id="proof-m" value={method} onChange={(e) => setMethod(e.target.value as ProofPaymentMethod)}
              className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm">
              {METHOD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <Input label="Txn / Ref ID" placeholder="e.g. 123456" value={txnRef} onChange={(e) => setTxnRef(e.target.value)} />
        </div>
        <div>
          <label htmlFor="proof-r" className="mb-1.5 block text-[13px] font-medium">Note (optional)</label>
          <textarea id="proof-r" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
            placeholder="Name + room no. as in payment remarks"
            className="w-full rounded-md border border-surface-border px-3 py-2 text-sm focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!file}>
            <Upload className="h-4 w-4" /> Submit for review
          </Button>
        </div>
      </div>
    </Modal>
  );
}
