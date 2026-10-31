"use client";

import { useState } from "react";
import { X, CreditCard, AlertTriangle, CheckCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import { hostelGhar, toApiError } from "@/lib/hostelGhar";
import { useToast } from "@/hooks/useToast";
import type { Fee } from "@/lib/api-types";
import { ReceiptModal, type ReceiptData } from "./ReceiptModal";

interface PartialPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  fee: Fee | null;
  hostelName?: string;
  onSuccess?: () => void;
}

export function PartialPaymentDialog({
  open,
  onClose,
  fee,
  hostelName,
  onSuccess,
}: PartialPaymentDialogProps) {
  const { success, error: toastError } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("ESEWA");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  if (!open || !fee) return null;

  const total = Number(fee.totalPayable ?? fee.amount);
  const alreadyPaid = Number(fee.paidAmount ?? 0);
  const outstanding = Math.max(0, total - alreadyPaid);
  const isOverdue = fee.status === "OVERDUE";

  const numAmount = Number(amount) || 0;
  const balanceAfter = Math.max(0, outstanding - numAmount);
  const isAmountValid = numAmount > 0 && numAmount <= outstanding;

  const handlePayRemaining = () => {
    setAmount(String(outstanding));
  };

  const handlePayHalf = () => {
    const half = Math.round((outstanding / 2) * 100) / 100;
    setAmount(String(half));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAmountValid) return;

    setIsSubmitting(true);
    try {
      const res = await hostelGhar.resident.payFee(fee.id, {
        amount: numAmount,
        paymentMethod: method,
        transactionReference: transactionRef.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      const resData = (res.data as any)?.data || res.data;
      const paymentObj = resData?.payment || resData;

      success(
        balanceAfter === 0
          ? "Invoice fully settled! Thank you."
          : `Partial payment of ${formatCurrency(numAmount)} recorded.`
      );

      setReceiptData({
        receiptNumber: paymentObj?.receiptNumber || `REC-${Date.now()}`,
        paidAt: paymentObj?.paidAt || new Date().toISOString(),
        amount: numAmount,
        paymentMethod: method,
        transactionReference: transactionRef || null,
        remarks: remarks || null,
        student: {
          name: fee.residentName || "Student",
          roomNumber: fee.roomNumber,
        },
        hostel: {
          name: hostelName || "Hostel Ghar",
        },
        invoice: {
          invoiceNumber: fee.invoiceNumber,
          billingMonth: fee.billingMonth,
          billingYear: fee.billingYear,
          totalPayable: total,
          paidAmount: alreadyPaid + numAmount,
          outstandingAmount: balanceAfter,
          status: balanceAfter === 0 ? "PAID" : "PARTIALLY_PAID",
        },
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      toastError(toApiError(err).message || "Payment submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (receiptData) {
    return (
      <ReceiptModal
        open={true}
        onClose={() => {
          setReceiptData(null);
          onClose();
        }}
        data={receiptData}
      />
    );
  }

  return (
    <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#C3FF7D]" />
            <div>
              <h3 className="text-base font-bold text-white">Make Fee Payment</h3>
              <p className="text-xs text-neutral-400">
                {fee.invoiceNumber || `Month ${fee.billingMonth}/${fee.billingYear}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Overdue Alert banner if fee is overdue */}
          {isOverdue && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p className="font-bold text-red-300">Invoice is Overdue</p>
                <p className="text-[11px] text-red-300/80">
                  Please clear your outstanding balance to avoid late fines.
                </p>
              </div>
            </div>
          )}

          {/* Balance Summary Box */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex justify-between text-xs text-neutral-400">
              <span>Total Monthly Fee:</span>
              <span className="font-semibold text-neutral-200">{formatCurrency(total)}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-neutral-400">
              <span>Already Paid:</span>
              <span className="font-semibold text-emerald-400">{formatCurrency(alreadyPaid)}</span>
            </div>
            <div className="mt-2.5 flex justify-between border-t border-neutral-800 pt-2 text-sm font-bold">
              <span className="text-neutral-300">Remaining Balance:</span>
              <span className="text-[#C3FF7D]">{formatCurrency(outstanding)}</span>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full bg-[#C3FF7D] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((alreadyPaid / total) * 100))}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[10px] text-neutral-500">
                {Math.round((alreadyPaid / total) * 100)}% paid
              </p>
            </div>
          </div>

          {/* Quick preset chips */}
          <div>
            <label className="text-xs font-semibold text-neutral-300">Quick Select Amount</label>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={handlePayRemaining}
                className="flex-1 rounded-xl border border-neutral-700 bg-neutral-800/80 px-3 py-2 text-xs font-bold text-neutral-200 hover:border-[#C3FF7D] hover:text-[#C3FF7D]"
              >
                Full Balance ({formatCurrency(outstanding)})
              </button>
              {outstanding > 1000 && (
                <button
                  type="button"
                  onClick={handlePayHalf}
                  className="flex-1 rounded-xl border border-neutral-700 bg-neutral-800/80 px-3 py-2 text-xs font-bold text-neutral-200 hover:border-[#C3FF7D] hover:text-[#C3FF7D]"
                >
                  Pay 50% ({formatCurrency(Math.round(outstanding / 2))})
                </button>
              )}
            </div>
          </div>

          {/* Custom amount input */}
          <div>
            <label className="text-xs font-semibold text-neutral-300">
              Payment Amount (NPR) <span className="text-red-400">*</span>
            </label>
            <div className="relative mt-1">
              <Input
                type="number"
                min="1"
                max={outstanding}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Enter amount up to ${outstanding}`}
                required
                className="border-neutral-700 bg-neutral-950 font-bold text-white"
              />
            </div>
            {numAmount > outstanding && (
              <p className="mt-1 text-xs text-red-400">
                Cannot exceed remaining balance of {formatCurrency(outstanding)}.
              </p>
            )}
          </div>

          {/* Live remaining balance projection */}
          {numAmount > 0 && numAmount <= outstanding && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs">
              <span className="text-neutral-400">Balance after payment:</span>
              <span className="flex items-center gap-1 font-bold text-white">
                {formatCurrency(balanceAfter)}
                {balanceAfter === 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-emerald-400">
                    <CheckCircle className="h-3 w-3" /> Fully Settled
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="text-xs font-semibold text-neutral-300">Payment Method</label>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {[
                { id: "ESEWA", label: "eSewa" },
                { id: "KHALTI", label: "Khalti" },
                { id: "BANK_TRANSFER", label: "Bank" },
                { id: "CASH", label: "Cash" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`rounded-xl border py-2 text-center text-xs font-bold transition-all ${
                    method === m.id
                      ? "border-[#C3FF7D] bg-[#C3FF7D] text-[#010101]"
                      : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Ref */}
          <div>
            <label className="text-xs font-semibold text-neutral-300">
              Transaction ID / Ref (Optional)
            </label>
            <Input
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. 9841234567 or TXN123"
              className="mt-1 border-neutral-700 bg-neutral-950 text-white"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="text-xs font-semibold text-neutral-300">Remarks (Optional)</label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. 1st installment for Kartik fee"
              className="mt-1 border-neutral-700 bg-neutral-950 text-white"
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3 border-t border-neutral-800 pt-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isAmountValid || isSubmitting}
              className="gap-1.5 bg-[#C3FF7D] font-bold text-[#010101] hover:bg-[#b0f065]"
            >
              <ShieldCheck className="h-4 w-4" />
              {isSubmitting
                ? "Processing…"
                : `Confirm Payment of ${numAmount > 0 ? formatCurrency(numAmount) : ""}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
