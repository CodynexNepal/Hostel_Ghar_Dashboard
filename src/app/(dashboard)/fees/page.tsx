"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId } from "@/lib/axios";
import {
  hostelGhar,
  normalizeResident,
  normalizeRoom,
  toApiError,
  toPaginated,
  unwrap,
} from "@/lib/hostelGhar";
import type { BackendFeeStatus, Fee, FeeStatus, HostelDetail } from "@/lib/api-types";
import type { Resident } from "@/types/resident";
import type { Room } from "@/types/hostel";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useDomainSocket } from "@/hooks/useDomainSocket";
import { PaymentProofReview } from "@/components/payments/PaymentProofReview";
import { useHostelPaymentProofs, proofStatusTone, proofStatusLabel } from "@/lib/payment-proofs";
import { RecordCashPaymentModal } from "@/components/payments/RecordCashPaymentModal";
import { ReceiptModal, type ReceiptData } from "@/components/payments/ReceiptModal";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";

export interface FeeRow {
  id: string;
  invoiceNumber?: string | null;
  residentId?: string;
  residentName: string;
  roomNumber: string;
  hostelId?: string;
  feeType?: string;
  billingMonth?: number;
  billingYear?: number;
  amount: number;
  dueAmount?: number;
  totalPayable?: number;
  paidAmount?: number;
  discountAmount?: number;
  outstandingAmount?: number;
  dueDate: string;
  status: FeeStatus;
  payments?: any[];
}

/** Backend sends PARTIALLY_PAID; UI normalizes both spellings to PARTIAL. */
function toFeeRowStatus(raw: Fee["status"] | string | undefined): FeeStatus {
  const v = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (v === "PARTIAL" || v === "PARTIALLY_PAID" || v === "PARTIALLY-PAID") return "PARTIAL";
  if (v === "PAID" || v === "PENDING" || v === "OVERDUE") return v;
  return "PENDING";
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function billingLabel(month?: number, year?: number): string {
  if (!month || !year) return "—";
  return `${MONTH_NAMES[month - 1] ?? ""} ${year}`;
}

/** Backend Fee → table row, joining owner resident data for name/room. */
function feeToRow(
  f: Fee,
  roomByResident: Map<string, string>,
  nameByResident: Map<string, string>
): FeeRow {
  const nested = f.resident ?? null;
  const nestedName =
    nested?.name ??
    nested?.fullName ??
    [nested?.firstName, nested?.lastName].filter(Boolean).join(" ") ??
    "";
  const nestedRoom =
    nested?.roomNumber ??
    nested?.room_number ??
    nested?.room?.roomNumber ??
    nested?.room?.room_number ??
    "";
  const total = Number(f.totalPayable ?? f.amount) || 0;
  const paid = Number(f.paidAmount ?? 0);
  const outstanding =
    f.outstandingAmount !== undefined ? Number(f.outstandingAmount) : Math.max(0, total - paid);

  return {
    id: String(f.id),
    invoiceNumber: f.invoiceNumber ?? null,
    residentId: f.residentId ?? nested?.id,
    residentName:
      (nestedName || "").trim() ||
      f.residentName ||
      (f.residentId ? (nameByResident.get(f.residentId) ?? "Resident") : "Resident"),
    roomNumber:
      (nestedRoom || "").trim() || (f.residentId ? (roomByResident.get(f.residentId) ?? "") : ""),
    hostelId: f.hostelId,
    feeType: f.feeType,
    billingMonth: f.billingMonth,
    billingYear: f.billingYear,
    amount: Number(f.amount) || 0,
    dueAmount: f.dueAmount !== undefined ? Number(f.dueAmount) : undefined,
    totalPayable: total,
    paidAmount: paid,
    discountAmount: Number(f.discountAmount ?? 0),
    outstandingAmount: outstanding,
    dueDate: f.dueDate ?? "",
    status: toFeeRowStatus(f.status),
    payments: Array.isArray(f.payments) ? f.payments : [],
  };
}

/** Resolve hostel id: session → cookie → first hostel. */
async function resolveHostelId(preferred?: string | null): Promise<string | null> {
  if (preferred) return preferred;
  const fromCookie = getHostelId();
  if (fromCookie) return fromCookie;
  try {
    const list = await hostelGhar.hostels.list({ limit: 1 });
    return toPaginated<HostelDetail>(list.data).items[0]?.id ?? null;
  } catch {
    return null;
  }
}

export default function FeesPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [serverFees, setServerFees] = useState<FeeRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncingOverdue, setIsSyncingOverdue] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  // Modals
  const [recordPaymentFee, setRecordPaymentFee] = useState<FeeRow | null>(null);
  const [viewReceipt, setViewReceipt] = useState<ReceiptData | null>(null);

  const {
    proofs,
    pendingCount,
    isLoading: proofsLoading,
    refetch: refetchProofs,
  } = useHostelPaymentProofs(hostelId);
  const proofByFee = new Map(proofs.map((p) => [String(p.feeId), p]));

  const refreshFees = useCallback(
    async (hid: string, status?: string, month?: number, year?: number, search?: string) => {
      const params: Record<string, string | number> = {};
      if (status) params.status = status;
      if (month) params.month = month;
      if (year) params.year = year;
      if (search) params.search = search;

      const res = await hostelGhar.fees.hostelFees(hid, params as any);
      const items = toPaginated<Fee>(res.data).items;
      const roomById = new Map(residents.map((r) => [r.id, r.roomNumber]));
      const nameById = new Map(residents.map((r) => [r.id, r.name]));
      return items.map((f) => feeToRow(f, roomById, nameById));
    },
    [residents]
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const hid = await resolveHostelId(user?.hostelId);
      setHostelId(hid);
      if (!hid) {
        setResidents([]);
        setRooms([]);
        setServerFees([]);
        setIsLoading(false);
        return;
      }
      let loadedResidents: Resident[] = [];
      try {
        const res = await hostelGhar.owner.residents({ hostelId: hid });
        const items = toPaginated<unknown>(unwrap<unknown>(res.data)).items;
        loadedResidents = items.map(normalizeResident);
      } catch {
        loadedResidents = [];
      }

      if (loadedResidents.length === 0) {
        try {
          const res = await hostelGhar.hostels.residents(hid);
          const items = toPaginated<unknown>(unwrap<unknown>(res.data)).items;
          loadedResidents = items.map(normalizeResident);
        } catch {
          /* keep empty */
        }
      }

      let loadedRooms: Room[] = [];
      try {
        const res = await hostelGhar.rooms.list({ limit: 100, hostelId: hid });
        const items = toPaginated<unknown>(res.data).items;
        loadedRooms = items.map(normalizeRoom);
      } catch {
        loadedRooms = [];
      }

      let mapped: FeeRow[] = [];
      try {
        const params: Record<string, string | number> = {};
        if (statusFilter) params.status = statusFilter;
        if (selectedMonth) params.month = Number(selectedMonth);
        if (selectedYear) params.year = Number(selectedYear);
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const res = await hostelGhar.fees.hostelFees(hid, params as any);
        const items = toPaginated<Fee>(res.data).items;
        const roomById = new Map(loadedResidents.map((r) => [r.id, r.roomNumber]));
        const nameById = new Map(loadedResidents.map((r) => [r.id, r.name]));
        mapped = items.map((f) => feeToRow(f, roomById, nameById));
      } catch {
        mapped = [];
      }

      setResidents(loadedResidents);
      setRooms(loadedRooms);
      setServerFees(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load fee data.");
      setServerFees([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.hostelId, statusFilter, selectedMonth, selectedYear, searchQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Realtime: payment:processed / hostel:updated refresh the ledger
  useDomainSocket({
    userId: user?.id,
    role: user?.role,
    hostelId,
    onEvent: useCallback(
      (event: string) => {
        if ((event === "payment:processed" || event === "hostel:updated") && hostelId) {
          void refreshFees(
            hostelId,
            statusFilter || undefined,
            selectedMonth ? Number(selectedMonth) : undefined,
            selectedYear ? Number(selectedYear) : undefined,
            searchQuery.trim() || undefined
          )
            .then((rows) => setServerFees(rows))
            .catch(() => undefined);
        }
      },
      [hostelId, refreshFees, statusFilter, selectedMonth, selectedYear, searchQuery]
    ),
  });

  const fees = useMemo(() => serverFees ?? [], [serverFees]);

  const totals = useMemo(() => {
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;
    let overdueCount = 0;

    fees.forEach((f) => {
      paid += Number(f.paidAmount ?? 0);
      outstanding += Number(f.outstandingAmount ?? 0);
      if (f.status === "OVERDUE") {
        overdue += Number(f.outstandingAmount ?? f.totalPayable ?? f.amount);
        overdueCount += 1;
      }
    });

    return { paid, outstanding, overdue, overdueCount };
  }, [fees]);

  async function handleSyncOverdue() {
    if (!hostelId) return;
    setIsSyncingOverdue(true);
    try {
      const res = await hostelGhar.fees.syncOverdue(hostelId);
      const data = unwrap<{ count: number }>(res.data);
      success(
        "Overdue statuses synchronized",
        `Updated ${data?.count ?? 0} invoice(s) based on due dates.`
      );
      await loadData();
    } catch (err) {
      toastError("Failed to sync overdue", toApiError(err).message);
    } finally {
      setIsSyncingOverdue(false);
    }
  }

  async function handleGenerateMonthly() {
    if (!hostelId) {
      toastError("No hostel linked", "Link your account to a hostel first.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await hostelGhar.fees.generateMonthly({ hostelId });
      const payload = unwrap<any>(res.data);
      await loadData();
      const label =
        payload?.billingMonth && payload?.billingYear
          ? billingLabel(payload.billingMonth, payload.billingYear)
          : "this month";
      success(
        "Monthly fees generated",
        payload?.generated !== undefined
          ? `${payload.generated} bills for ${label}${payload.skipped ? ` · ${payload.skipped} skipped` : ""}.`
          : (payload?.message ?? `Ledger generated for ${label}.`)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't generate fees.";
      toastError("Couldn't generate fees", message);
    } finally {
      setIsGenerating(false);
    }
  }

  const columns: Column<FeeRow>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice / ID",
      sortable: true,
      render: (f) => (
        <div>
          <span className="font-mono text-xs font-semibold text-neutral-200">
            {f.invoiceNumber || `INV-${f.id.slice(0, 8)}`}
          </span>
          <span className="block text-[11px] text-neutral-500">{f.feeType || "MONTHLY_FEE"}</span>
        </div>
      ),
    },
    {
      key: "residentName",
      header: "Resident",
      sortable: true,
      render: (f) => (
        <div>
          <span className="block font-medium text-neutral-100">{f.residentName}</span>
          <span className="block text-xs text-neutral-400">Room {f.roomNumber || "—"}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Payable / Paid",
      sortable: true,
      render: (f) => {
        const total = Number(f.totalPayable ?? f.amount);
        const paid = Number(f.paidAmount ?? 0);
        const outstanding = Number(f.outstandingAmount ?? Math.max(0, total - paid));
        const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

        return (
          <div className="min-w-[140px]">
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-neutral-100">{formatCurrency(total)}</span>
              <span className="text-xs text-neutral-400">{progress}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  f.status === "PAID"
                    ? "bg-[#C3FF7D]"
                    : f.status === "OVERDUE"
                      ? "bg-rose-500"
                      : "bg-amber-400"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-400">
              <span>Paid: {formatCurrency(paid)}</span>
              {outstanding > 0 && (
                <span className="font-semibold text-amber-400">
                  Due: {formatCurrency(outstanding)}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "billingMonth",
      header: "Billing Period",
      sortable: true,
      render: (f) => (
        <span className="text-xs font-medium text-neutral-300">
          {billingLabel(f.billingMonth, f.billingYear)}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortable: true,
      render: (f) => (
        <span className="text-xs text-neutral-300">{f.dueDate ? formatDate(f.dueDate) : "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (f) => {
        let tone: "success" | "warning" | "danger" | "neutral" = "neutral";
        if (f.status === "PAID") tone = "success";
        else if (f.status === "PARTIAL") tone = "warning";
        else if (f.status === "OVERDUE") tone = "danger";

        return <Badge tone={tone}>{f.status === "PARTIAL" ? "PARTIALLY PAID" : f.status}</Badge>;
      },
    },
    {
      key: "receipt",
      header: "Audit / Proof",
      render: (f) => {
        const proof = proofByFee.get(String(f.id));
        const paymentCount = f.payments?.length ?? 0;

        if (paymentCount > 0) {
          const lastPayment = f.payments![paymentCount - 1];
          return (
            <button
              onClick={() => {
                setViewReceipt({
                  receiptNumber: lastPayment.receiptNumber || `RCP-${lastPayment.id?.slice(0, 8)}`,
                  invoiceNumber: f.invoiceNumber || `INV-${f.id.slice(0, 8)}`,
                  studentName: f.residentName,
                  roomNumber: f.roomNumber,
                  amount: Number(lastPayment.amount),
                  paymentMethod: lastPayment.paymentMethod || "CASH",
                  paidAt: lastPayment.paidAt || lastPayment.createdAt,
                  transactionReference: lastPayment.transactionReference,
                  receivedBy: lastPayment.receivedByUser?.name || "Hostel Admin",
                  totalPayable: Number(f.totalPayable ?? f.amount),
                  totalPaid: Number(f.paidAmount ?? lastPayment.amount),
                  outstandingBalance: Number(f.outstandingAmount ?? 0),
                  billingMonth: f.billingMonth,
                  billingYear: f.billingYear,
                });
              }}
              className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-[11px] font-medium text-[#C3FF7D] hover:bg-neutral-700"
              title="View latest payment receipt"
            >
              <FileText className="h-3 w-3" />
              {paymentCount} {paymentCount === 1 ? "Txn" : "Txns"}
            </button>
          );
        }

        if (proof) {
          return (
            <Badge tone={proofStatusTone(proof.status)}>{proofStatusLabel(proof.status)}</Badge>
          );
        }

        return <span className="text-xs text-neutral-500">—</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (f) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecordPaymentFee(f)}
            disabled={f.status === "PAID"}
            className={
              f.status === "PAID"
                ? "opacity-50"
                : "border-[#C3FF7D]/30 text-[#C3FF7D] hover:bg-[#C3FF7D]/10"
            }
          >
            {f.status === "PAID" ? "Settled" : "Record Payment"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardShell
      title="Fee Management"
      subtitle="Hostel Ghar / Finance / Fees — student monthly charges, collections, and overdue tracking."
    >
      <Protected permission="MANAGE_PAYMENTS" redirectTo="/dashboard">
        {/* KPI Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-neutral-800 bg-[#0d0d0d] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Total Collected
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C3FF7D]/10 text-[#C3FF7D]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-neutral-100">
              {formatCurrency(totals.paid)}
            </p>
            <p className="mt-1 text-xs text-neutral-400">Verified cash & digital payments</p>
          </Card>

          <Card className="border-neutral-800 bg-[#0d0d0d] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Outstanding Balance
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-400">
              {formatCurrency(totals.outstanding)}
            </p>
            <p className="mt-1 text-xs text-neutral-400">Pending & partially paid balances</p>
          </Card>

          <Card className="border-neutral-800 bg-[#0d0d0d] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Total Overdue
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-400">
              {formatCurrency(totals.overdue)}
            </p>
            <p className="mt-1 text-xs text-neutral-400">Past payment deadline</p>
          </Card>

          <Card className="border-neutral-800 bg-[#0d0d0d] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Overdue Students
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-neutral-100">{totals.overdueCount}</p>
            <p className="mt-1 text-xs text-neutral-400">Residents needing follow-up</p>
          </Card>
        </div>

        {/* Filter bar */}
        <div className="mb-6 space-y-4 rounded-xl border border-neutral-800 bg-[#0d0d0d] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Status tabs */}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {[
                { label: "All Invoices", value: "" },
                { label: "Pending", value: "PENDING" },
                { label: "Partially Paid", value: "PARTIAL" },
                { label: "Overdue", value: "OVERDUE" },
                { label: "Paid", value: "PAID" },
              ].map((tab) => {
                const active = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "bg-[#C3FF7D] text-[#010101] shadow-sm"
                        : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Actions: Sync Overdue & Generate Monthly */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSyncOverdue()}
                loading={isSyncingOverdue}
                disabled={!hostelId}
                className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                title="Evaluate due dates and mark overdue invoices"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Sync Overdue
              </Button>
              <Button
                size="sm"
                onClick={() => void handleGenerateMonthly()}
                loading={isGenerating}
                disabled={!hostelId}
                className="bg-[#C3FF7D] font-semibold text-[#010101] hover:bg-[#b0f562]"
              >
                Generate Monthly Fees
              </Button>
            </div>
          </div>

          {/* Secondary filter row: Search, Month, Year */}
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by student name or room number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-800 bg-neutral-900 pl-9 pr-3 text-xs text-neutral-200 placeholder-neutral-500 focus:border-[#C3FF7D] focus:outline-none"
              />
            </div>

            <div>
              <select
                aria-label="Filter by month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs text-neutral-200 focus:border-[#C3FF7D] focus:outline-none"
              >
                <option value="">All Months</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={String(idx + 1)}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                aria-label="Filter by year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs text-neutral-200 focus:border-[#C3FF7D] focus:outline-none"
              >
                <option value="">All Years</option>
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table / Content */}
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : fees.length === 0 ? (
          <EmptyState
            title={hostelId ? "No invoices found" : "No hostel linked"}
            description={
              hostelId
                ? loadError
                  ? `Backend ledger failed to load: ${loadError}`
                  : "No bills match the selected status or date filters. Click 'Generate Monthly Fees' to bill your active residents."
                : "Link your account to a hostel to see its financial ledger."
            }
            action={
              hostelId && !loadError ? (
                <Button onClick={() => void handleGenerateMonthly()} loading={isGenerating}>
                  Generate Monthly Fees
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable<FeeRow>
            columns={columns}
            rows={fees}
            rowKey={(row) => row.id}
            searchableKeys={["residentName", "roomNumber", "invoiceNumber"]}
            searchPlaceholder="Filter listed invoices…"
            mobileCard={(f) => (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-100">{f.residentName}</p>
                  <p className="text-xs text-neutral-400">
                    Room {f.roomNumber || "—"} · Payable:{" "}
                    {formatCurrency(f.totalPayable ?? f.amount)}
                  </p>
                  {Number(f.outstandingAmount ?? 0) > 0 && (
                    <p className="text-xs font-medium text-amber-400">
                      Due: {formatCurrency(Number(f.outstandingAmount))}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge
                    tone={
                      f.status === "PAID"
                        ? "success"
                        : f.status === "OVERDUE"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {f.status}
                  </Badge>
                  {f.status !== "PAID" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRecordPaymentFee(f)}
                      className="h-7 border-[#C3FF7D]/30 py-1 text-xs text-[#C3FF7D]"
                    >
                      Pay
                    </Button>
                  )}
                </div>
              </div>
            )}
          />
        )}

        {/* Resident QR receipts review section */}
        <div className="mt-8">
          <PaymentProofReview
            proofs={proofs}
            isLoading={proofsLoading}
            onChanged={() => {
              void refetchProofs();
              void loadData();
            }}
          />
          {pendingCount === 0 && proofs.length === 0 && (
            <p className="mt-2 text-xs text-neutral-400">
              No pending QR receipt approvals. When residents upload transfer screenshots, they will
              appear here for verification.
            </p>
          )}
        </div>

        {/* Modals */}
        <RecordCashPaymentModal
          open={Boolean(recordPaymentFee)}
          onClose={() => setRecordPaymentFee(null)}
          fee={recordPaymentFee}
          hostelName={user?.hostelName ?? "Hostel Ghar"}
          onSuccess={() => {
            setRecordPaymentFee(null);
            void loadData();
          }}
        />

        <ReceiptModal
          open={Boolean(viewReceipt)}
          onClose={() => setViewReceipt(null)}
          data={viewReceipt}
          hostelName={user?.hostelName ?? "Hostel Ghar"}
        />
      </Protected>
    </DashboardShell>
  );
}
