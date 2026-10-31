"use client";

import { useMemo, useState, useEffect } from "react";
import {
  QrCode,
  CreditCard,
  AlertTriangle,
  Receipt,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Smartphone,
  Building,
  History,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useMyFees } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";
import { useAuth } from "@/hooks/useAuth";
import { PaymentQrDialog } from "@/components/payments/PaymentQrDialog";
import { UploadProofDialog } from "@/components/payments/UploadProofDialog";
import { PartialPaymentDialog } from "@/components/payments/PartialPaymentDialog";
import { ReceiptModal, type ReceiptData } from "@/components/payments/ReceiptModal";
import { useMyPaymentProofs, proofStatusTone, proofStatusLabel } from "@/lib/payment-proofs";
import {
  PAYMENT_METHODS_META,
  downloadQrDataUrl,
  usePaymentQrs,
  type PaymentQrMethod,
} from "@/lib/payment-qr";
import { hostelGhar } from "@/lib/hostelGhar";
import type { Fee } from "@/lib/api-types";

export default function ResidentPaymentsPage() {
  const room = useMyRoomSummary();
  const { role, user } = useAuth();
  const { data, error, isLoading, retry, totalPendingDue, totalOverdue, totalPaid } = useMyFees();
  const { byFeeId: proofByFee, refetch: refetchProofs } = useMyPaymentProofs(room.hostelId);

  const [activeTab, setActiveTab] = useState<"invoices" | "transactions">("invoices");
  const [payFee, setPayFee] = useState<Fee | null>(null);
  const [uploadFee, setUploadFee] = useState<Fee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFee, setDialogFee] = useState<Fee | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [method, setMethod] = useState<PaymentQrMethod>("ESEWA");
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const { qrs, labels } = usePaymentQrs(room.hostelId, { mode: "resident", role });
  const fees = useMemo(() => data ?? [], [data]);

  // Determine current active due bill (overdue first, else partially paid or pending)
  const due = useMemo(() => {
    const overdue = fees.find((f) => f.status === "OVERDUE");
    if (overdue) return overdue;
    const partial = fees.find((f) => f.status === "PARTIALLY_PAID" || f.status === "PARTIAL");
    if (partial) return partial;
    return fees.find((f) => f.status !== "PAID" && f.status !== "CANCELLED") ?? null;
  }, [fees]);

  // Aggregate calculations
  const totalBilled = useMemo(
    () => fees.reduce((sum, f) => sum + Number(f.totalPayable ?? f.amount ?? 0), 0),
    [fees]
  );
  const totalPaidSum = useMemo(
    () => totalPaid ?? fees.reduce((sum, f) => sum + Number(f.paidAmount ?? 0), 0),
    [fees, totalPaid]
  );
  const pendingSum = useMemo(
    () =>
      totalPendingDue ??
      fees.reduce((sum, f) => {
        if (f.status === "PAID" || f.status === "CANCELLED") return sum;
        const total = Number(f.totalPayable ?? f.amount ?? 0);
        const paid = Number(f.paidAmount ?? 0);
        return sum + Math.max(0, total - paid);
      }, 0),
    [fees, totalPendingDue]
  );
  const overdueSum = useMemo(
    () =>
      totalOverdue ??
      fees
        .filter((f) => f.status === "OVERDUE")
        .reduce((sum, f) => {
          const total = Number(f.totalPayable ?? f.amount ?? 0);
          const paid = Number(f.paidAmount ?? 0);
          return sum + Math.max(0, total - paid);
        }, 0),
    [fees, totalOverdue]
  );

  // Load individual payment transactions
  useEffect(() => {
    let cancelled = false;
    async function loadTxns() {
      setLoadingTxns(true);
      try {
        const res = await hostelGhar.resident.payments({ limit: 50 });
        const items = (res.data as any)?.items || (res.data as any)?.data || [];
        if (!cancelled) setRecentTransactions(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) setRecentTransactions([]);
      } finally {
        if (!cancelled) setLoadingTxns(false);
      }
    }
    loadTxns();
    return () => {
      cancelled = true;
    };
  }, []);

  const progressPercent =
    totalBilled > 0 ? Math.min(100, Math.round((totalPaidSum / totalBilled) * 100)) : 100;

  function handleOpenQr(fee?: Fee) {
    setDialogFee(fee ?? due ?? null);
    setDialogOpen(true);
  }

  function handleOpenReceipt(f: Fee) {
    const total = Number(f.totalPayable ?? f.amount);
    const paid = Number(f.paidAmount ?? 0);
    const rem = Math.max(0, total - paid);

    setReceiptData({
      receiptNumber: `REC-${f.billingYear || "2026"}${String(f.billingMonth || "01").padStart(2, "0")}-${String(f.id).slice(0, 8).toUpperCase()}`,
      paidAt: f.paidAt || f.updatedAt || new Date().toISOString(),
      amount: paid > 0 ? paid : total,
      paymentMethod: f.method || "CASH",
      student: {
        name: f.residentName || user?.name || "Student",
        roomNumber: f.roomNumber || room.myRoom?.roomNumber,
        bedNumber: room.myRoom?.bedNumber,
      },
      hostel: {
        name: room.hostelName || "Hostel Ghar",
      },
      invoice: {
        invoiceNumber: f.invoiceNumber || `INV-${f.id.slice(0, 8).toUpperCase()}`,
        billingMonth: f.billingMonth,
        billingYear: f.billingYear,
        totalPayable: total,
        paidAmount: paid,
        outstandingAmount: rem,
        status: f.status,
      },
    });
  }

  return (
    <DashboardShell title="Fee Payments & Invoices" subtitle={room.hostelName}>
      <div className="space-y-6">
        {/* OVERDUE ALERT BANNER */}
        {overdueSum > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-950/60 to-neutral-900 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/30 text-red-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-red-300">
                  You Have Overdue Payments ({formatCurrency(overdueSum)})
                </h4>
                <p className="mt-0.5 text-xs text-red-300/80">
                  Payment deadline has passed for past invoice(s). Please clear your overdue dues to
                  avoid penalties or disruption.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {due && due.status === "OVERDUE" && (
                <Button
                  size="sm"
                  onClick={() => setPayFee(due)}
                  className="bg-red-500 font-bold text-white hover:bg-red-600"
                >
                  Pay Overdue Balance
                </Button>
              )}
            </div>
          </div>
        )}

        {/* TOP KPI CARDS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Monthly Fee / Total Billed */}
          <Card className="border-neutral-800 bg-neutral-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Monthly Hostel Fee
            </p>
            {isLoading ? (
              <Skeleton className="mt-2 h-7 w-28 bg-neutral-800" />
            ) : (
              <>
                <p className="mt-1.5 text-2xl font-black text-white">
                  {due ? formatCurrency(Number(due.amount)) : formatCurrency(totalBilled || 10500)}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  {due
                    ? `Month ${due.billingMonth ?? ""}/${due.billingYear ?? ""}`
                    : "All time billed"}
                </p>
              </>
            )}
          </Card>

          {/* Card 2: Total Paid */}
          <Card className="border-neutral-800 bg-neutral-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Total Amount Paid
            </p>
            {isLoading ? (
              <Skeleton className="mt-2 h-7 w-28 bg-neutral-800" />
            ) : (
              <>
                <p className="mt-1.5 text-2xl font-black text-emerald-400">
                  {formatCurrency(totalPaidSum)}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-[#C3FF7D]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-neutral-400">{progressPercent}%</span>
                </div>
              </>
            )}
          </Card>

          {/* Card 3: Outstanding Balance */}
          <Card className="border-neutral-800 bg-neutral-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Outstanding Balance
            </p>
            {isLoading ? (
              <Skeleton className="mt-2 h-7 w-28 bg-neutral-800" />
            ) : (
              <>
                <p
                  className={`mt-1.5 text-2xl font-black ${
                    pendingSum > 0 ? "text-[#C3FF7D]" : "text-emerald-400"
                  }`}
                >
                  {formatCurrency(pendingSum)}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  {pendingSum > 0 ? "Remaining to be settled" : "All cleared 🎉"}
                </p>
              </>
            )}
          </Card>

          {/* Card 4: Next Payment Due */}
          <Card className="border-neutral-800 bg-neutral-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Next Due Date
            </p>
            {isLoading ? (
              <Skeleton className="mt-2 h-7 w-28 bg-neutral-800" />
            ) : due?.dueDate ? (
              <>
                <p className="mt-1.5 text-2xl font-black text-white">{formatDate(due.dueDate)}</p>
                <Badge tone={due.status === "OVERDUE" ? "red" : "amber"} className="mt-1">
                  {due.status === "OVERDUE" ? "OVERDUE" : "DUE SOON"}
                </Badge>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-2xl font-black text-emerald-400">No Dues</p>
                <p className="mt-1 text-xs text-neutral-400">Next cycle on 1st</p>
              </>
            )}
          </Card>
        </div>

        {/* TABS HEADER */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "invoices"
                  ? "bg-[#C3FF7D] text-[#010101]"
                  : "bg-neutral-900 text-neutral-400 hover:text-white"
              }`}
            >
              <Receipt className="h-4 w-4" /> Monthly Invoices ({fees.length})
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "transactions"
                  ? "bg-[#C3FF7D] text-[#010101]"
                  : "bg-neutral-900 text-neutral-400 hover:text-white"
              }`}
            >
              <History className="h-4 w-4" /> Payment Receipts ({recentTransactions.length})
            </button>
          </div>

          {due && (
            <Button
              size="sm"
              onClick={() => setPayFee(due)}
              className="gap-1.5 bg-[#C3FF7D] font-bold text-[#010101] hover:bg-[#b0f065]"
            >
              <CreditCard className="h-3.5 w-3.5" /> Pay Due (
              {formatCurrency(
                Math.max(0, Number(due.totalPayable ?? due.amount) - Number(due.paidAmount ?? 0))
              )}
              )
            </Button>
          )}
        </div>

        {/* TAB 1: INVOICES LIST */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-2xl bg-neutral-900" />
                <Skeleton className="h-20 w-full rounded-2xl bg-neutral-900" />
              </div>
            ) : error ? (
              <ErrorState
                title="Failed to load invoices"
                description={error.message}
                onRetry={retry}
              />
            ) : fees.length === 0 ? (
              <EmptyState
                title="No Invoices Yet"
                description="Your monthly hostel fee bills will appear here."
              />
            ) : (
              <div className="space-y-3">
                {fees.map((f) => {
                  const billTotal = Number(f.totalPayable ?? f.amount);
                  const paid = Number(f.paidAmount ?? 0);
                  const remaining = Math.max(0, billTotal - paid);
                  const isFullyPaid = f.status === "PAID" || remaining === 0;
                  const isOverdue = f.status === "OVERDUE";
                  const percentPaid = billTotal > 0 ? Math.round((paid / billTotal) * 100) : 0;
                  const proof = proofByFee.get(String(f.id));

                  return (
                    <div
                      key={f.id}
                      className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 transition-all hover:border-neutral-700 sm:flex-row sm:items-center sm:justify-between"
                    >
                      {/* Left: Invoice info */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-neutral-400">
                            {f.invoiceNumber || `INV-${f.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <span className="text-neutral-600">·</span>
                          <span className="text-sm font-bold text-white">
                            {f.month ?? `Month ${f.billingMonth}/${f.billingYear}`}
                          </span>
                          <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                          {proof && (
                            <Badge tone={proofStatusTone(proof.status)}>
                              Proof: {proofStatusLabel(proof.status)}
                            </Badge>
                          )}
                        </div>

                        {/* Amount breakdown */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300">
                          <span>
                            Total: <strong>{formatCurrency(billTotal)}</strong>
                          </span>
                          <span>·</span>
                          <span className="text-emerald-400">
                            Paid: <strong>{formatCurrency(paid)}</strong>
                          </span>
                          <span>·</span>
                          <span
                            className={
                              remaining > 0 ? "font-bold text-[#C3FF7D]" : "text-neutral-400"
                            }
                          >
                            Remaining: {formatCurrency(remaining)}
                          </span>
                        </div>

                        {/* Due date notice */}
                        <p className="text-[11px] text-neutral-500">
                          Due Date: {f.dueDate ? formatDate(f.dueDate) : "—"}
                          {isOverdue && (
                            <span className="ml-2 font-bold text-red-400">⚠️ Past Due Date</span>
                          )}
                        </p>

                        {/* Mini progress bar */}
                        {!isFullyPaid && (
                          <div className="mt-2 flex max-w-xs items-center gap-2">
                            <div className="h-1.5 w-full rounded-full bg-neutral-800">
                              <div
                                className="h-full rounded-full bg-[#C3FF7D]"
                                style={{ width: `${percentPaid}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-neutral-400">{percentPaid}%</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {/* If balance remains, allow partial or full payment */}
                        {!isFullyPaid && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setPayFee(f)}
                              className="gap-1.5 bg-[#C3FF7D] text-xs font-bold text-[#010101] hover:bg-[#b0f065]"
                            >
                              <CreditCard className="h-3.5 w-3.5" /> Pay Installment
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenQr(f)}
                              className="gap-1 border-neutral-700 text-xs text-neutral-200 hover:text-white"
                            >
                              <QrCode className="h-3.5 w-3.5" /> QR
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setUploadFee(f)}
                              className="gap-1 text-xs text-neutral-400 hover:text-white"
                            >
                              <Download className="h-3.5 w-3.5 rotate-180" /> Upload Receipt
                            </Button>
                          </>
                        )}

                        {/* Receipt view for paid or partially paid bills */}
                        {paid > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenReceipt(f)}
                            className="gap-1 text-xs text-neutral-300 hover:text-white"
                          >
                            <Receipt className="h-3.5 w-3.5" /> View Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INDIVIDUAL TRANSACTIONS */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            {loadingTxns ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-2xl bg-neutral-900" />
                <Skeleton className="h-16 w-full rounded-2xl bg-neutral-900" />
              </div>
            ) : recentTransactions.length === 0 ? (
              <EmptyState
                title="No Payment Records Yet"
                description="Once payments are recorded through cash or digital options, audit receipts appear here."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="border-b border-neutral-800 bg-neutral-950 text-[11px] font-bold uppercase text-neutral-400">
                    <tr>
                      <th className="px-5 py-3.5">Receipt #</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Amount</th>
                      <th className="px-5 py-3.5">Method</th>
                      <th className="px-5 py-3.5">Reference / Notes</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {recentTransactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-neutral-800/40">
                        <td className="px-5 py-3.5 font-mono font-bold text-white">
                          {tx.receiptNumber || `REC-${String(tx.id).slice(0, 8)}`}
                        </td>
                        <td className="px-5 py-3.5 text-neutral-400">{formatDate(tx.paidAt)}</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-400">
                          {formatCurrency(Number(tx.amount))}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-neutral-200">
                          {tx.paymentMethod || "CASH"}
                        </td>
                        <td className="max-w-xs truncate px-5 py-3.5 text-neutral-400">
                          {tx.transactionReference || tx.remarks || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setReceiptData({
                                receiptNumber: tx.receiptNumber,
                                paidAt: tx.paidAt,
                                amount: Number(tx.amount),
                                paymentMethod: tx.paymentMethod,
                                transactionReference: tx.transactionReference,
                                remarks: tx.remarks,
                                student: {
                                  name: user?.name || "Student",
                                  roomNumber: room.myRoom?.roomNumber,
                                },
                                hostel: {
                                  name: room.hostelName || "Hostel",
                                },
                                invoice: {
                                  invoiceNumber: tx.fee?.invoiceNumber,
                                },
                              })
                            }
                            className="gap-1 text-xs"
                          >
                            <Receipt className="h-3 w-3" /> Receipt
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Partial / Remaining Payment Dialog */}
      <PartialPaymentDialog
        open={Boolean(payFee)}
        onClose={() => setPayFee(null)}
        fee={payFee}
        hostelName={room.hostelName}
        onSuccess={() => {
          retry();
          // Reload txns
          hostelGhar.resident.payments({ limit: 50 }).then((res) => {
            const items = (res.data as any)?.items || (res.data as any)?.data || [];
            setRecentTransactions(Array.isArray(items) ? items : []);
          });
        }}
      />

      {/* Full-featured QR Dialog */}
      <PaymentQrDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onPaid={() => {
          setDialogOpen(false);
          setUploadFee(dialogFee ?? due ?? null);
        }}
        method={method}
        hostelId={room.hostelId}
        hostelName={room.hostelName}
        amountLabel={
          dialogFee
            ? formatCurrency(
                Math.max(
                  0,
                  Number(dialogFee.totalPayable ?? dialogFee.amount) -
                    Number(dialogFee.paidAmount ?? 0)
                )
              )
            : undefined
        }
        feeDescription={
          dialogFee?.month ??
          (dialogFee?.billingMonth && dialogFee?.billingYear
            ? `${dialogFee.billingMonth}/${dialogFee.billingYear}`
            : undefined)
        }
      />

      {/* Receipt Upload Modal */}
      <UploadProofDialog
        open={Boolean(uploadFee)}
        onClose={() => setUploadFee(null)}
        fee={uploadFee}
        hostelId={room.hostelId}
        residentId={user?.id ?? null}
        residentName={user?.name}
        residentEmail={user?.email}
        roomNumber={room.myRoom?.roomNumber}
        existingProof={uploadFee ? (proofByFee.get(String(uploadFee.id)) ?? null) : null}
        onSubmitted={() => refetchProofs()}
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        open={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />
    </DashboardShell>
  );
}
