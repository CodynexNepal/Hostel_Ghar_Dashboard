import { useCallback, useEffect, useState } from "react";
import api, { getHostelId } from "./axios";
import { hostelGhar, toPaginated, unwrap } from "./hostelGhar";

const PREFIX = "/v1/hostel-ghar";

export type PaymentProofStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ProofPaymentMethod = "ESEWA" | "KHALTI" | "BANK" | "CASH";

export interface PaymentProof {
  id: string;
  feeId: string;
  hostelId?: string | null;
  residentId?: string | null;
  residentName?: string;
  residentEmail?: string;
  roomNumber?: string;
  feeLabel?: string;
  amount: number;
  method: ProofPaymentMethod;
  transactionRef?: string;
  remarks?: string;
  imageUrl: string;
  status: PaymentProofStatus;
  reviewNote?: string;
  reviewedBy?: string;
  createdAt: string;
  reviewedAt?: string;
  source: "backend" | "local";
  [key: string]: unknown;
}

export interface UploadProofInput {
  feeId: string;
  hostelId?: string | null;
  residentId?: string | null;
  residentName?: string;
  residentEmail?: string;
  roomNumber?: string;
  feeLabel?: string;
  amount: number;
  method: ProofPaymentMethod;
  transactionRef?: string;
  remarks?: string;
  file?: File | null;
  imageUrl?: string;
}

export interface ReviewProofInput {
  action: "APPROVE" | "REJECT";
  amount?: number;
  method?: ProofPaymentMethod;
  note?: string;
}

const LS_KEY = "hg_payment_proofs_v1";
export const PAYMENT_PROOFS_EVENT = "hg:payment-proofs-changed";

export function readLocalProofs(): PaymentProof[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaymentProof[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalProofs(rows: PaymentProof[]) {
  if (typeof window === "undefined") return;
  try {
    const next = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    let bytes = JSON.stringify(next).length;
    while (bytes > 4_500_000 && next.length > 1) {
      const idx = next.findIndex((r) => r.status !== "PENDING");
      next.splice(idx === -1 ? next.length - 1 : idx, 1);
      bytes = JSON.stringify(next).length;
    }
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* quota — memory only */
  }
  window.dispatchEvent(new CustomEvent(PAYMENT_PROOFS_EVENT));
}

export function listLocalProofs(filter?: { hostelId?: string | null; feeId?: string }): PaymentProof[] {
  let rows = readLocalProofs();
  if (filter?.hostelId) rows = rows.filter((r) => !r.hostelId || r.hostelId === filter.hostelId);
  if (filter?.feeId) rows = rows.filter((r) => r.feeId === filter.feeId);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveLocalProof(row: PaymentProof): PaymentProof {
  const rows = readLocalProofs();
  const idx = rows.findIndex((r) => r.id === row.id);
  if (idx >= 0) rows[idx] = row;
  else rows.unshift(row);
  writeLocalProofs(rows);
  return row;
}

export function updateLocalProof(id: string, patch: Partial<PaymentProof>): PaymentProof | null {
  const rows = readLocalProofs();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch };
  writeLocalProofs(rows);
  return rows[idx];
}

export function proofFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error("Screenshot must be under 4MB. Compress or crop it and retry."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function isMissingEndpoint(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 405 || status === 501;
}

export function normalizeProof(raw: unknown): PaymentProof | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, fb = ""): string =>
    typeof v === "string" ? v : v === undefined || v === null ? fb : String(v);
  const num = (v: unknown, fb = 0): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : fb;
  };
  const id = str(r.id ?? r._id ?? r.proofId ?? r.paymentProofId);
  if (!id) return null;
  const rawStatus = str(r.status ?? r.reviewStatus ?? r.verificationStatus, "PENDING").toUpperCase();
  const status: PaymentProofStatus = rawStatus.includes("APPROV")
    ? "APPROVED"
    : rawStatus.includes("REJECT")
      ? "REJECTED"
      : "PENDING";
  const rawMethod = str(r.method ?? r.paymentMethod ?? r.provider, "ESEWA").toUpperCase();
  const method: ProofPaymentMethod = rawMethod.includes("KHALTI")
    ? "KHALTI"
    : rawMethod.includes("BANK")
      ? "BANK"
      : rawMethod.includes("CASH")
        ? "CASH"
        : "ESEWA";
  const nested = (r.resident ?? r.user ?? null) as Record<string, unknown> | null;
  return {
    id,
    feeId: str(r.feeId ?? r.fee_id ?? r.billId),
    hostelId: str(r.hostelId ?? r.hostel_id, "") || null,
    residentId: str(r.residentId ?? r.resident_id ?? nested?.id ?? nested?._id, "") || null,
    residentName: str(r.residentName ?? r.resident_name) || str(nested?.name ?? nested?.fullName) || "Resident",
    residentEmail: str(r.residentEmail ?? nested?.email, "") || undefined,
    roomNumber: str(r.roomNumber ?? r.room_number ?? nested?.roomNumber, "") || undefined,
    feeLabel: str(r.feeLabel ?? r.month ?? r.billingLabel, "") || undefined,
    amount: num(r.amount ?? r.paidAmount, 0),
    method,
    transactionRef: str(r.transactionRef ?? r.transactionId ?? r.txnId ?? r.reference, "") || undefined,
    remarks: str(r.remarks ?? r.note ?? r.description, "") || undefined,
    imageUrl: str(r.imageUrl ?? r.screenshotUrl ?? r.receiptUrl ?? r.proofUrl ?? r.screenshot ?? r.receipt ?? r.image ?? r.url),
    status,
    reviewNote: str(r.reviewNote ?? r.rejectionReason ?? r.adminNote, "") || undefined,
    reviewedBy: str(r.reviewedBy ?? r.verifiedBy, "") || undefined,
    createdAt: str(r.createdAt ?? r.submittedAt ?? r.uploadedAt) || new Date().toISOString(),
    reviewedAt: str(r.reviewedAt ?? r.verifiedAt, "") || undefined,
    source: "backend",
  };
}

export async function uploadPaymentProof(input: UploadProofInput): Promise<PaymentProof> {
  const imageUrl = input.imageUrl ?? "";
  try {
    if (input.file) {
      const form = new FormData();
      form.append("screenshot", input.file, input.file.name);
      form.append("receipt", input.file, input.file.name);
      form.append("amount", String(input.amount));
      form.append("method", input.method);
      if (input.transactionRef) {
        form.append("transactionRef", input.transactionRef);
        form.append("transactionId", input.transactionRef);
      }
      if (input.remarks) form.append("remarks", input.remarks);
      if (input.hostelId) form.append("hostelId", input.hostelId);
      const res = await api.post(`${PREFIX}/fees/${input.feeId}/payment-proofs`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const norm = normalizeProof(unwrap<unknown>((res as { data?: unknown }).data ?? res));
      if (norm) return norm;
    } else {
      const res = await api.post(`${PREFIX}/fees/${input.feeId}/payment-proofs`, {
        amount: input.amount,
        method: input.method,
        transactionRef: input.transactionRef,
        remarks: input.remarks,
        imageUrl,
        hostelId: input.hostelId,
      });
      const norm = normalizeProof(unwrap<unknown>((res as { data?: unknown }).data ?? res));
      if (norm) return norm;
    }
  } catch (err) {
    if (!isMissingEndpoint(err)) {
      const status = (err as { response?: { status?: number } })?.response?.status ?? 0;
      if (status !== 0) throw err;
    }
  }
  const row: PaymentProof = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    feeId: input.feeId,
    hostelId: input.hostelId ?? getHostelId(),
    residentId: input.residentId ?? null,
    residentName: input.residentName ?? "Resident",
    residentEmail: input.residentEmail,
    roomNumber: input.roomNumber,
    feeLabel: input.feeLabel,
    amount: input.amount,
    method: input.method,
    transactionRef: input.transactionRef,
    remarks: input.remarks,
    imageUrl,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    source: "local",
  };
  return saveLocalProof(row);
}

export async function fetchMyProofs(opts?: { hostelId?: string | null }): Promise<PaymentProof[]> {
  let backend: PaymentProof[] = [];
  try {
    const res = await hostelGhar.resident.paymentProofs();
    backend = toPaginated<unknown>(res.data).items
      .map(normalizeProof)
      .filter((p): p is PaymentProof => Boolean(p));
  } catch {
    backend = [];
  }
  const local = listLocalProofs({ hostelId: opts?.hostelId ?? null });
  const seen = new Set(backend.map((b) => b.id));
  const overlayByFee = new Map<string, PaymentProof>();
  for (const l of local) {
    if (l.id.startsWith("overlay-")) overlayByFee.set(l.feeId, l);
  }
  const merged = backend.map((b) => {
    const over = overlayByFee.get(b.feeId);
    if (over && (over.reviewedAt ?? "") >= (b.createdAt ?? "")) {
      return { ...b, status: over.status, reviewNote: over.reviewNote, reviewedAt: over.reviewedAt };
    }
    return b;
  });
  return [...merged, ...local.filter((l) => !seen.has(l.id) && !l.id.startsWith("overlay-"))].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function fetchHostelProofs(hostelId: string): Promise<PaymentProof[]> {
  let backend: PaymentProof[] = [];
  try {
    const res = await hostelGhar.fees.hostelPaymentProofs(hostelId);
    backend = toPaginated<unknown>(res.data).items
      .map(normalizeProof)
      .filter((p): p is PaymentProof => Boolean(p));
  } catch {
    backend = [];
  }
  const local = listLocalProofs({ hostelId });
  const orphans = readLocalProofs().filter((r) => !r.hostelId);
  const seen = new Set(backend.map((b) => b.id));
  const merged = [...backend];
  for (const row of [...local, ...orphans]) {
    if (!seen.has(row.id) && !merged.some((m) => m.id === row.id)) merged.push(row);
  }
  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function reviewPaymentProof(proof: PaymentProof, input: ReviewProofInput): Promise<PaymentProof> {
  const now = new Date().toISOString();
  try {
    const res = await api.patch(`${PREFIX}/payment-proofs/${proof.id}/review`, {
      action: input.action,
      note: input.note,
      amount: input.amount ?? proof.amount,
      method: input.method ?? proof.method,
    });
    const norm = normalizeProof(unwrap<unknown>((res as { data?: unknown }).data ?? res));
    if (norm) {
      if (proof.source === "local") updateLocalProof(proof.id, { status: norm.status });
      if (input.action === "APPROVE") {
        try {
          await hostelGhar.fees.recordPayment(proof.feeId, {
            amount: input.amount ?? proof.amount,
            method: (input.method ?? proof.method) as "CASH" | "ESEWA" | "KHALTI" | "BANK",
            remarks: input.note ?? proof.transactionRef ?? "QR receipt approved",
          });
        } catch {
          /* ledger sync best-effort */
        }
      }
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PAYMENT_PROOFS_EVENT));
      return norm;
    }
  } catch (err) {
    if (!isMissingEndpoint(err)) {
      const status = (err as { response?: { status?: number } })?.response?.status ?? 0;
      if (status !== 0) throw err;
    }
  }
  const status: PaymentProofStatus = input.action === "APPROVE" ? "APPROVED" : "REJECTED";
  if (input.action === "APPROVE") {
    try {
      await hostelGhar.fees.recordPayment(proof.feeId, {
        amount: input.amount ?? proof.amount,
        method: (input.method ?? proof.method) as "CASH" | "ESEWA" | "KHALTI" | "BANK",
        remarks: input.note ?? proof.transactionRef ?? "QR receipt approved",
      });
    } catch {
      /* backend ledger unavailable — flips when backend syncs */
    }
  }
  const updated: PaymentProof = {
    ...proof,
    status,
    reviewNote: input.note,
    reviewedAt: now,
    reviewedBy: "Hostel Owner",
    amount: input.amount ?? proof.amount,
    method: input.method ?? proof.method,
  };
  if (proof.source === "local") return saveLocalProof(updated) ?? updated;
  saveLocalProof({ ...updated, id: `overlay-${proof.id}`, source: "local" });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PAYMENT_PROOFS_EVENT));
  return updated;
}

export function proofStatusTone(status: PaymentProofStatus): string {
  if (status === "APPROVED") return "green";
  if (status === "PENDING") return "amber";
  return "red";
}

export function proofStatusLabel(status: PaymentProofStatus): string {
  if (status === "PENDING") return "Pending review";
  if (status === "APPROVED") return "Approved · Paid";
  return "Rejected";
}

export function useMyPaymentProofs(hostelId?: string | null) {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const rows = await fetchMyProofs({ hostelId: hostelId ?? null });
      setProofs(rows);
    } catch {
      setProofs(listLocalProofs({ hostelId: hostelId ?? null }));
    } finally {
      setIsLoading(false);
    }
  }, [hostelId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(PAYMENT_PROOFS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PAYMENT_PROOFS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);
  const byFeeId = new Map<string, PaymentProof>();
  for (const p of proofs) {
    const prev = byFeeId.get(p.feeId);
    if (!prev || p.createdAt >= prev.createdAt) byFeeId.set(p.feeId, p);
  }
  return { proofs, byFeeId, isLoading, refetch: load };
}

export function useHostelPaymentProofs(hostelId?: string | null) {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(hostelId));
  const load = useCallback(async () => {
    if (!hostelId) {
      setProofs(readLocalProofs());
      setIsLoading(false);
      return;
    }
    try {
      const rows = await fetchHostelProofs(hostelId);
      setProofs(rows);
    } catch {
      setProofs(listLocalProofs({ hostelId }));
    } finally {
      setIsLoading(false);
    }
  }, [hostelId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(PAYMENT_PROOFS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PAYMENT_PROOFS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);
  const pending = proofs.filter((p) => p.status === "PENDING");
  return { proofs, pending, pendingCount: pending.length, isLoading, refetch: load };
}
