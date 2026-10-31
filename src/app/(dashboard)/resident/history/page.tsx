"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useMyFees } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";
import { useAuth } from "@/hooks/useAuth";
import { useMyPaymentProofs, proofStatusLabel, proofStatusTone } from "@/lib/payment-proofs";
import { ReceiptModal, type ReceiptData } from "@/components/payments/ReceiptModal";
import { hostelGhar } from "@/lib/hostelGhar";
import { Receipt, History, CreditCard } from "lucide-react";

export default function ResidentHistoryPage() {
  const room = useMyRoomSummary();
  const { user } = useAuth();
  const { data, error, isLoading, retry } = useMyFees();
  const { byFeeId: proofByFee } = useMyPaymentProofs(room.hostelId);
  const fees = data ?? [];

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [tab, setTab] = useState<"bills" | "payments">("bills");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingTxns(true);
      try {
        const res = await hostelGhar.resident.payments({ limit: 50 });
        const items = (res.data as any)?.items || (res.data as any)?.data || [];
        if (!cancelled) setTransactions(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) setTransactions([]);
      } finally {
        if (!cancelled) setLoadingTxns(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleOpenReceipt(item: any, isTxn: boolean = false) {
    if (isTxn) {
      setReceiptData({
        receiptNumber: item.receiptNumber,
        paidAt: item.paidAt,
        amount: Number(item.amount),
        paymentMethod: item.paymentMethod,
        transactionReference: item.transactionReference,
        remarks: item.remarks,
        student: {
          name: user?.name || "Student",
          roomNumber: room.myRoom?.roomNumber,
        },
        hostel: {
          name: room.hostelName || "Hostel",
        },
        invoice: {
          invoiceNumber: item.fee?.invoiceNumber,
        },
      });
    } else {
      const total = Number(item.totalPayable ?? item.amount);
      const paid = Number(item.paidAmount ?? 0);
      setReceiptData({
        receiptNumber: `REC-${item.billingYear || "2026"}${String(item.billingMonth || "01").padStart(2, "0")}-${String(item.id).slice(0, 8).toUpperCase()}`,
        paidAt: item.paidAt || item.updatedAt,
        amount: paid > 0 ? paid : total,
        paymentMethod: item.method || "CASH",
        student: {
          name: item.residentName || user?.name || "Student",
          roomNumber: item.roomNumber || room.myRoom?.roomNumber,
        },
        hostel: {
          name: room.hostelName || "Hostel",
        },
        invoice: {
          invoiceNumber: item.invoiceNumber,
          billingMonth: item.billingMonth,
          billingYear: item.billingYear,
          totalPayable: total,
          paidAmount: paid,
          outstandingAmount: Math.max(0, total - paid),
          status: item.status,
        },
      });
    }
  }

  return (
    <DashboardShell title="Payment & Bill History" subtitle={room.hostelName}>
      <div className="space-y-4">
        {/* Navigation tabs */}
        <div className="flex gap-2 border-b border-neutral-800 pb-2">
          <button
            onClick={() => setTab("bills")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tab === "bills"
                ? "bg-[#C3FF7D] text-[#010101]"
                : "bg-neutral-900 text-neutral-400 hover:text-white"
            }`}
          >
            <Receipt className="h-4 w-4" /> Billed Invoices ({fees.length})
          </button>
          <button
            onClick={() => setTab("payments")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tab === "payments"
                ? "bg-[#C3FF7D] text-[#010101]"
                : "bg-neutral-900 text-neutral-400 hover:text-white"
            }`}
          >
            <History className="h-4 w-4" /> Completed Payments ({transactions.length})
          </button>
        </div>

        {tab === "bills" ? (
          <Card className="border-neutral-800 bg-neutral-900 text-white">
            <div className="border-b border-neutral-800 px-5 py-4">
              <p className="text-[15px] font-bold">Monthly Fee Invoices</p>
              <p className="text-[13px] text-neutral-400">
                Complete ledger of monthly charges and settlement records
              </p>
            </div>
            {isLoading ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-10 w-full bg-neutral-800" />
                <Skeleton className="h-10 w-full bg-neutral-800" />
              </div>
            ) : error ? (
              <div className="p-5">
                <ErrorState
                  title="Couldn't load history"
                  description={error.message}
                  onRetry={retry}
                />
              </div>
            ) : fees.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No history yet"
                  description="Paid and pending bills will appear here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-neutral-800">
                {fees.map((p) => {
                  const proof = proofByFee.get(String(p.id));
                  const total = Number(p.totalPayable ?? p.amount);
                  const paid = Number(p.paidAmount ?? 0);
                  const rem = Math.max(0, total - paid);

                  return (
                    <li
                      key={p.id}
                      className="flex flex-col justify-between gap-3 px-5 py-4 hover:bg-neutral-800/40 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-400">
                            {p.invoiceNumber || `INV-${p.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <span className="text-neutral-600">·</span>
                          <span className="text-sm font-bold text-white">
                            {p.month ?? `Month ${p.billingMonth}/${p.billingYear}`}
                          </span>
                          <span className="text-sm font-extrabold text-[#C3FF7D]">
                            {formatCurrency(total)}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400">
                          {p.dueDate ? `Due: ${formatDate(p.dueDate)}` : ""}
                          {paid > 0 ? ` · Paid so far: ${formatCurrency(paid)}` : ""}
                          {rem > 0 ? ` · Remaining: ${formatCurrency(rem)}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                        {proof && (
                          <Badge tone={proofStatusTone(proof.status)}>
                            Proof: {proofStatusLabel(proof.status)}
                          </Badge>
                        )}
                        {paid > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenReceipt(p, false)}
                            className="gap-1 border-neutral-700 text-xs text-neutral-200"
                          >
                            <Receipt className="h-3 w-3" /> Receipt
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ) : (
          <Card className="border-neutral-800 bg-neutral-900 text-white">
            <div className="border-b border-neutral-800 px-5 py-4">
              <p className="text-[15px] font-bold">Payment Receipts</p>
              <p className="text-[13px] text-neutral-400">
                Audit trail of verified partial and full payments
              </p>
            </div>
            {loadingTxns ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-10 w-full bg-neutral-800" />
                <Skeleton className="h-10 w-full bg-neutral-800" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No transactions yet"
                  description="Your processed payments will appear here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-neutral-800">
                {transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 hover:bg-neutral-800/40 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-neutral-300">
                        {tx.receiptNumber || `REC-${String(tx.id).slice(0, 8)}`}
                      </p>
                      <p className="text-sm font-extrabold text-emerald-400">
                        {formatCurrency(Number(tx.amount))} via {tx.paymentMethod || "CASH"}
                      </p>
                      <p className="text-xs text-neutral-400">
                        Paid on {formatDate(tx.paidAt)}{" "}
                        {tx.transactionReference ? `· Ref: ${tx.transactionReference}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenReceipt(tx, true)}
                      className="gap-1.5 border-neutral-700 text-xs text-neutral-200"
                    >
                      <Receipt className="h-3.5 w-3.5" /> View / Print Receipt
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <ReceiptModal
        open={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />
    </DashboardShell>
  );
}
