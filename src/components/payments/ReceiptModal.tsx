"use client";

import { useRef } from "react";
import {
  Printer,
  X,
  CheckCircle,
  Building2,
  Calendar,
  CreditCard,
  User,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface ReceiptData {
  receiptNumber?: string | null;
  paymentId?: string;
  paidAt?: string | Date;
  amount: number;
  paymentMethod?: string;
  transactionReference?: string | null;
  remarks?: string | null;
  studentName?: string;
  roomNumber?: string;
  invoiceNumber?: string | null;
  receivedBy?: string;
  totalPayable?: number;
  totalPaid?: number;
  outstandingBalance?: number;
  billingMonth?: number;
  billingYear?: number;
  student?: {
    name?: string;
    email?: string;
    phone?: string | null;
    roomNumber?: string;
    bedNumber?: string | null;
  };
  hostel?: {
    name?: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
  };
  invoice?: {
    invoiceNumber?: string | null;
    billingMonth?: number;
    billingYear?: number;
    totalPayable?: number;
    paidAmount?: number;
    outstandingAmount?: number;
    status?: string;
  };
  receiver?: string;
}

export interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
  hostelName?: string;
}

export function ReceiptModal({ open, onClose, data, hostelName }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!open || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoice = data.invoice;
  const student = data.student;
  const hostel = data.hostel;

  const resolvedStudentName = data.studentName || student?.name || "Resident";
  const resolvedRoomNumber = data.roomNumber || student?.roomNumber || "—";
  const resolvedInvoiceNumber = data.invoiceNumber || invoice?.invoiceNumber || "—";
  const resolvedHostelName = hostelName || hostel?.name || "Hostel Ghar";
  const resolvedReceiver = data.receivedBy || data.receiver || "Authorized Officer";

  const totalBilled = data.totalPayable ?? invoice?.totalPayable ?? data.amount;
  const totalPaidAfter = data.totalPaid ?? invoice?.paidAmount ?? data.amount;
  const remaining =
    data.outstandingBalance ??
    invoice?.outstandingAmount ??
    Math.max(0, totalBilled - totalPaidAfter);

  const dateString = data.paidAt
    ? typeof data.paidAt === "string"
      ? data.paidAt
      : data.paidAt.toISOString()
    : new Date().toISOString();

  return (
    <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-neutral-800" />
            <h3 className="text-base font-bold text-neutral-900">Payment Receipt</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="gap-1.5 text-xs font-semibold"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div ref={receiptRef} className="p-6 text-neutral-800">
          {/* Hostel Header */}
          <div className="border-b border-dashed border-neutral-300 pb-5 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-ink text-[#C3FF7D]">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-neutral-900">{resolvedHostelName}</h2>
            <p className="text-xs text-neutral-500">
              {[hostel?.address, hostel?.city].filter(Boolean).join(", ") || "Kathmandu, Nepal"}
              {hostel?.phone ? ` · Tel: ${hostel.phone}` : ""}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <CheckCircle className="h-3.5 w-3.5" /> Payment Successful
            </div>
          </div>

          {/* Receipt & Invoice Meta */}
          <div className="grid grid-cols-2 gap-4 border-b border-neutral-100 py-4 text-xs">
            <div>
              <p className="text-[11px] font-medium text-neutral-400">RECEIPT NO.</p>
              <p className="font-mono font-bold text-neutral-900">
                {data.receiptNumber || `RCP-${String(data.paymentId || "").slice(0, 8)}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-neutral-400">INVOICE REF.</p>
              <p className="font-bold text-neutral-800">{resolvedInvoiceNumber}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-neutral-400">DATE & TIME</p>
              <p className="font-semibold text-neutral-700">{formatDate(dateString)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-neutral-400">PAYMENT METHOD</p>
              <p className="font-semibold text-neutral-700">{data.paymentMethod || "CASH"}</p>
            </div>
          </div>

          {/* Student Info Box */}
          <div className="my-4 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-neutral-900">
              <User className="h-3.5 w-3.5 text-neutral-500" />
              <span>Resident Details</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <span className="text-neutral-500">Name:</span>{" "}
                <span className="font-semibold text-neutral-900">{resolvedStudentName}</span>
              </div>
              <div>
                <span className="text-neutral-500">Room:</span>{" "}
                <span className="font-semibold text-neutral-900">{resolvedRoomNumber}</span>
              </div>
              {student?.phone && (
                <div>
                  <span className="text-neutral-500">Phone:</span>{" "}
                  <span className="text-neutral-700">{student.phone}</span>
                </div>
              )}
              {data.transactionReference && (
                <div>
                  <span className="text-neutral-500">Txn Ref:</span>{" "}
                  <span className="font-mono text-neutral-700">{data.transactionReference}</span>
                </div>
              )}
            </div>
          </div>

          {/* Amount Breakdown Table */}
          <div className="space-y-2 border-t border-neutral-100 pt-4 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Total Payable Amount</span>
              <span className="font-semibold">{formatCurrency(totalBilled)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Amount Paid This Transaction</span>
              <span className="font-bold text-emerald-600">+{formatCurrency(data.amount)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Cumulative Amount Paid</span>
              <span className="font-semibold">{formatCurrency(totalPaidAfter)}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-neutral-200 pt-2 text-sm font-bold">
              <span>Remaining Outstanding Balance</span>
              <span className={remaining > 0 ? "text-amber-600" : "text-neutral-900"}>
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>

          {/* Receiver & Sign-off footer */}
          <div className="mt-6 border-t border-neutral-100 pt-4 text-[11px] text-neutral-500">
            <div className="flex items-center justify-between">
              <span>
                Authorized Receiver:{" "}
                <strong className="text-neutral-800">{resolvedReceiver}</strong>
              </span>
              <span className="font-mono text-[10px] text-neutral-400">Status: Verified</span>
            </div>
            <p className="mt-2 text-center text-[10px] text-neutral-400">
              This is a computer-generated digital receipt issued by {resolvedHostelName} via Hostel
              Ghar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
