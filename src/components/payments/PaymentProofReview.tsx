"use client";
import { useMemo, useState } from "react";
import { Check, Eye, ShieldCheck, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  proofStatusLabel,
  proofStatusTone,
  reviewPaymentProof,
  type PaymentProof,
} from "@/lib/payment-proofs";

interface Props {
  proofs: PaymentProof[];
  isLoading?: boolean;
  onChanged?: () => void;
}

function ReviewBody({ view, note, setNote, busy, decide }: {
  view: PaymentProof; note: string; setNote: (v: string) => void;
  busy: boolean; decide: (p: PaymentProof, a: "APPROVE" | "REJECT") => void;
}) {
  return (
    <div className="space-y-3">
      {view.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={view.imageUrl} alt="Receipt full" className="max-h-80 w-full rounded-xl border bg-neutral-50 object-contain" />
      ) : (<p className="rounded-xl bg-neutral-50 p-4 text-center text-sm text-neutral-500">No screenshot.</p>)}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-lg bg-neutral-50 px-2.5 py-1.5">Txn: <b>{view.transactionRef || "—"}</b></span>
        <span className="rounded-lg bg-neutral-50 px-2.5 py-1.5">Bill: <b>{view.feeLabel || view.feeId.slice(0, 8)}</b></span>
      </div>
      {view.remarks && <p className="text-xs text-neutral-600">Note: {view.remarks}</p>}
      {view.status !== "PENDING" ? (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs">Already {view.status.toLowerCase()}{view.reviewNote ? ` — ${view.reviewNote}` : ""}</p>
      ) : (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Review note"
            placeholder="Approve note or rejection reason…" className="w-full rounded-md border border-surface-border px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-red-700" disabled={busy} onClick={() => decide(view, "REJECT")}>
              <X className="h-4 w-4" /> Reject</Button>
            <Button className="flex-1" loading={busy} onClick={() => decide(view, "APPROVE")}>
              <Check className="h-4 w-4" /> Approve · paid</Button>
          </div>
        </>
      )}
    </div>
  );
}


export function PaymentProofReview({ proofs, isLoading, onChanged }: Props) {
  const { success, error: toastError } = useToast();
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [view, setView] = useState<PaymentProof | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const list = filter === "ALL" ? proofs : proofs.filter((r) => r.status === "PENDING");
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [proofs, filter]);
  const pendingCount = proofs.filter((r) => r.status === "PENDING").length;
  async function decide(proof: PaymentProof, action: "APPROVE" | "REJECT") {
    if (action === "REJECT" && !note.trim()) {
      toastError("Add a reason", "Tell the resident why it was rejected.");
      return;
    }
    setBusyId(proof.id);
    try {
      await reviewPaymentProof(proof, { action, note: note.trim() || undefined });
      success(action === "APPROVE" ? "Approved" : "Rejected",
        action === "APPROVE" ? "Fee marked as paid." : "Resident can resubmit.");
      setNote(""); setView(null); onChanged?.();
    } catch (e) { toastError("Failed", e instanceof Error ? e.message : "Retry."); }
    finally { setBusyId(null); }
  }
  if (isLoading) return <Card className="p-5 text-sm text-neutral-500">Loading receipts…</Card>;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <ShieldCheck className="h-4 w-4 text-brand-ink" /> Payment receipts
            {pendingCount > 0 && <Badge tone="amber">{pendingCount} pending</Badge>}
          </p>
          <p className="text-[13px] text-neutral-500">Resident QR screenshots — approve to mark paid.</p>
        </div>
        <div className="flex gap-1.5">
          {(["PENDING", "ALL"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-brand-ink text-white" : "bg-neutral-100 text-neutral-600"}`}>
              {f === "PENDING" ? `Pending (${pendingCount})` : `All (${proofs.length})`}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-500">No receipts here yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3">
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt="proof" className="h-12 w-12 shrink-0 rounded-lg border object-cover" />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">No img</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.residentName}</span>
                <span className="block truncate text-xs text-neutral-500">{formatCurrency(r.amount)} · {r.method} · {formatDate(r.createdAt)}</span>
              </span>
              <Badge tone={proofStatusTone(r.status)}>{proofStatusLabel(r.status)}</Badge>
              <Button size="sm" variant="outline" onClick={() => { setView(r); setNote(r.reviewNote ?? ""); }}>
                <Eye className="h-3.5 w-3.5" /> Review
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(view)} onClose={() => setView(null)} title="Review receipt"
        description={view ? `${view.residentName} · ${formatCurrency(view.amount)}` : undefined}>
        {view && <ReviewBody view={view} note={note} setNote={setNote} busy={busyId === view.id} decide={decide} />}
      </Modal>
    </Card>
  );
}
