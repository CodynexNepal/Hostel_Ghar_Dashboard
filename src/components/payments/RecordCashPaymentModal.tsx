"use client";

import { useState } from "react";
import { X, CheckCircle, Wallet, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import { hostelGhar, toApiError } from "@/lib/hostelGhar";
import { useToast } from "@/hooks/useToast";
import type { Fee } from "@/lib/api-types";
import { ReceiptModal, type ReceiptData } from "./ReceiptModal";

interface RecordCashPaymentModalProps {
  open: boolean;
  onClose: () => void;
  fee: {
    id: string;
    residentName?: string;
    roomNumber?: string;
    invoiceNumber?: string | null;
    billingMonth?: number;
    billingYear?: number;
    amount: number;
    totalPayable?: number;
    paidAmount?: number;
    dueDate?: string;
    status?: string;
  } | null;
  hostelName?: string;
  onSuccess?: () => void;
}

export function RecordCashPaymentModal({
  open,
  onClose,
  fee,
  hostelName,
  onSuccess,
}: RecordCashPaymentModalProps) {
  const { success, error: toastError } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("CASH");
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  if (!open || !fee) return null;

  const total = Number(fee.totalPayable ?? fee.amount);
  const alreadyPaid = Number(fee.paidAmount ?? 0);
  const outstanding = Math.max(0, total - alreadyPaid);

  const numAmount = Number(amount) || (amount === "" ? outstanding : 0);
  const effectiveAmount = amount === "" ? outstanding : numAmount;
  const balanceAfter = Math.max(0, outstanding - effectiveAmount);
  const isAmountValid = effectiveAmount > 0 && effectiveAmount <= outstanding;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAmountValid) return;

    setIsSubmitting(true);
    try {
      const res = await hostelGhar.fees.recordPayment(fee.id, {
        amount: effectiveAmount,
        method,
        paymentMethod: method,
        paidAt,
        transactionReference: transactionRef.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      const resData = (res.data as any)?.data || res.data;
      const paymentObj = resData?.payment || resData;

      success(`Payment of ${formatCurrency(effectiveAmount)} recorded successfully.`);

      setReceiptData({
        receiptNumber: paymentObj?.receiptNumber || `REC-${Date.now()}`,
        paidAt,
        amount: effectiveAmount,
        paymentMethod: method,
        transactionReference: transactionRef || null,
        remarks: remarks || null,
        student: {
          name: fee.residentName || "Resident",
          roomNumber: fee.roomNumber,
        },
        hostel: {
          name: hostelName || "Hostel",
        },
        invoice: {
          invoiceNumber: fee.invoiceNumber,
          billingMonth: fee.billingMonth,
          billingYear: fee.billingYear,
          totalPayable: total,
          paidAmount: alreadyPaid + effectiveAmount,
          outstandingAmount: balanceAfter,
          status: balanceAfter === 0 ? "PAID" : "PARTIALLY_PAID",
        },
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      toastError(toApiError(err).message || "Failed to record payment");
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
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#C3FF7D]" />
            <div>
              <h3 className="text-base font-bold text-white">Record Payment</h3>
              <p className="text-xs text-neutral-400">
                {fee.residentName
                  ? `${fee.residentName} · Room ${fee.roomNumber || "—"}`
                  : "Student Invoice"}
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
          {/* Invoice Summary */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-neutral-400">Invoice:</span>{" "}
                <span className="font-semibold text-neutral-200">{fee.invoiceNumber || "—"}</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-400">Billing:</span>{" "}
                <span className="font-semibold text-neutral-200">
                  {fee.billingMonth && fee.billingYear
                    ? `${fee.billingMonth}/${fee.billingYear}`
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400">Total Payable:</span>{" "}
                <span className="font-semibold text-neutral-200">{formatCurrency(total)}</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-400">Already Paid:</span>{" "}
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(alreadyPaid)}
                </span>
              </div>
            </div>
            <div className="mt-3 flex justify-between border-t border-neutral-800 pt-2 text-sm font-bold">
              <span className="text-neutral-300">Remaining Due:</span>
              <span className="text-[#C3FF7D]">{formatCurrency(outstanding)}</span>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300">
                Payment Amount (NPR) <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setAmount(String(outstanding))}
                className="text-xs font-bold text-[#C3FF7D] hover:underline"
              >
                Set Full Due ({formatCurrency(outstanding)})
              </button>
            </div>
            <Input
              type="number"
              min="1"
              max={outstanding}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(outstanding)}
              className="mt-1 border-neutral-700 bg-neutral-950 font-bold text-white"
              required
            />
          </div>

          {/* Balance projection */}
          {effectiveAmount > 0 && effectiveAmount <= outstanding && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs">
              <span className="text-neutral-400">Remaining after this entry:</span>
              <span className="flex items-center gap-1 font-bold text-white">
                {formatCurrency(balanceAfter)}
                {balanceAfter === 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-emerald-400">
                    <CheckCircle className="h-3 w-3" /> Settles Bill
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="text-xs font-semibold text-neutral-300">Payment Method</label>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {[
                { id: "CASH", label: "Cash" },
                { id: "ESEWA", label: "eSewa" },
                { id: "KHALTI", label: "Khalti" },
                { id: "BANK_TRANSFER", label: "Bank" },
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

          {/* Payment Date */}
          <div>
            <label className="text-xs font-semibold text-neutral-300">Payment Date</label>
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="mt-1 border-neutral-700 bg-neutral-950 text-white"
              required
            />
          </div>

          {/* Reference & Remarks */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300">Ref / Receipt #</label>
              <Input
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="Optional ref"
                className="mt-1 border-neutral-700 bg-neutral-950 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-300">Remarks / Note</label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional note"
                className="mt-1 border-neutral-700 bg-neutral-950 text-xs text-white"
              />
            </div>
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
              {isSubmitting ? "Recording…" : `Confirm ${formatCurrency(effectiveAmount)}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
