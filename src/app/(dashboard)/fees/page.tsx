"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId } from "@/lib/axios";
import {
  hostelGhar,
  normalizeResident,
  normalizeRoom,
  toPaginated,
  unwrap,
} from "@/lib/hostelGhar";
import type { Fee, HostelDetail } from "@/lib/api-types";
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

interface FeeRow {
  id: string;
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
  dueDate: string;
  status: "PAID" | "PENDING" | "OVERDUE" | "PARTIAL";
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function billingLabel(month?: number, year?: number): string {
  if (!month || !year) return "—";
  return `${MONTH_NAMES[month - 1] ?? ""} ${year}`;
}

/** Backend Fee → table row, joining owner resident data for name/room. */
function feeToRow(
  f: Fee,
  roomByResident: Map<string, string>,
  nameByResident: Map<string, string>,
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
  return {
    id: String(f.id),
    residentId: f.residentId ?? nested?.id,
    residentName:
      (nestedName || "").trim() ||
      f.residentName ||
      (f.residentId ? (nameByResident.get(f.residentId) ?? "Resident") : "Resident"),
    roomNumber:
      (nestedRoom || "").trim() ||
      (f.residentId ? (roomByResident.get(f.residentId) ?? "") : ""),
    hostelId: f.hostelId,
    feeType: f.feeType,
    billingMonth: f.billingMonth,
    billingYear: f.billingYear,
    amount: Number(f.amount) || 0,
    dueAmount: f.dueAmount !== undefined ? Number(f.dueAmount) : undefined,
    totalPayable: Number(f.totalPayable ?? total) || 0,
    paidAmount: f.paidAmount !== undefined ? Number(f.paidAmount) : undefined,
    dueDate: f.dueDate ?? "",
    status: f.status,
  };
}

const selectClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";

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

const INITIAL_FEES: FeeRow[] = [
  { id: "fee-1", residentName: "Aashish Shah", roomNumber: "A-101", amount: 9000, dueDate: "2026-09-10", status: "PAID" },
  { id: "fee-2", residentName: "Suman Gurung", roomNumber: "A-101", amount: 9000, dueDate: "2026-09-15", status: "PENDING" },
  { id: "fee-3", residentName: "Ramesh Karki", roomNumber: "B-202", amount: 12000, dueDate: "2026-09-08", status: "OVERDUE" },
  { id: "fee-4", residentName: "Nisha Rai", roomNumber: "C-305", amount: 10500, dueDate: "2026-09-20", status: "PARTIAL" },
];

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
  const [statusFilter, setStatusFilter] = useState("");
  const [paying, setPaying] = useState<FeeRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payError, setPayError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const { proofs, pendingCount, isLoading: proofsLoading, refetch: refetchProofs } =
    useHostelPaymentProofs(hostelId);
  const proofByFee = new Map(proofs.map((p) => [String(p.feeId), p]));

  const refreshFees = useCallback(
    async (hid: string, status?: string) => {
      const res = await hostelGhar.fees.hostelFees(hid, status ? { status } : undefined);
      const items = toPaginated<Fee>(res.data).items;
      const roomById = new Map(residents.map((r) => [r.id, r.roomNumber]));
      const nameById = new Map(residents.map((r) => [r.id, r.name]));
      return items.map((f) => feeToRow(f, roomById, nameById));
    },
    [residents]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const hid = await resolveHostelId(user?.hostelId);
        if (cancelled) return;
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
          // GET /fees/hostels/:hostelId — owner/admin ledger.
          const res = await hostelGhar.fees.hostelFees(hid, statusFilter ? { status: statusFilter } : undefined);
          const items = toPaginated<Fee>(res.data).items;
          const roomById = new Map(loadedResidents.map((r) => [r.id, r.roomNumber]));
          const nameById = new Map(loadedResidents.map((r) => [r.id, r.name]));
          mapped = items.map((f) => feeToRow(f, roomById, nameById));
        } catch {
          mapped = [];
        }
        if (cancelled) return;
        setResidents(loadedResidents);
        setRooms(loadedRooms);
        setServerFees(mapped);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Couldn't load fee data.");
          setServerFees([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.hostelId, statusFilter]);

  // Realtime: payment:processed / hostel:updated refresh the ledger.
  // Joins user:<id>, role:<ROLE>, hostel:<id> per backend socket spec.
  useDomainSocket({
    userId: user?.id,
    role: user?.role,
    hostelId,
    onEvent: useCallback(
      (event: string) => {
        if ((event === "payment:processed" || event === "hostel:updated") && hostelId) {
          void refreshFees(hostelId, statusFilter || undefined)
            .then((rows) => setServerFees(rows))
            .catch(() => undefined);
        }
      },
      [hostelId, refreshFees, statusFilter]
    ),
  });

  const fees: FeeRow[] = useMemo(() => {
    const rows = serverFees ?? [];
    if (rows.length === 0 && loadError) return INITIAL_FEES;
    return rows;
  }, [serverFees, loadError]);
  const usingFallback =
    fees.length > 0 && (serverFees ?? []).length === 0 && Boolean(loadError);

  const totals = useMemo(() => {
    const totalOf = (f: FeeRow) => Number(f.totalPayable ?? f.amount) || 0;
    const paid = fees.filter((f) => f.status === "PAID").reduce((s, i) => s + totalOf(i), 0);
    const pending = fees.filter((f) => f.status === "PENDING" || f.status === "PARTIAL").reduce((s, i) => s + totalOf(i), 0);
    const overdue = fees.filter((f) => f.status === "OVERDUE").reduce((s, i) => s + totalOf(i), 0);
    return { paid, pending, overdue };
  }, [fees]);

  async function handleGenerateMonthly() {
    if (!hostelId) {
      toastError("No hostel linked", "Link your account to a hostel first.");
      return;
    }
    // POST /fees/generate-monthly — owner/admin only (backend enforces role).
    setIsGenerating(true);
    try {
      const res = await hostelGhar.fees.generateMonthly({ hostelId });
      const payload = unwrap<unknown>(res.data) as {
        message?: string;
        generated?: number;
        skipped?: number;
        billingMonth?: number;
        billingYear?: number;
      };
      const rows = await refreshFees(hostelId, statusFilter || undefined);
      setServerFees(rows);
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

  function openPayModal(row: FeeRow) {
    setPaying(row);
    const remaining = Number(row.totalPayable ?? row.amount) - Number(row.paidAmount ?? 0);
    setPayAmount(String(Math.max(0, Math.round(remaining))));
    setPayMethod("CASH");
    setPayError(null);
  }

  /** Backend derives status: paidAmount >= totalPayable → PAID, >0 → PARTIAL. */
  function previewStatus(row: FeeRow, addAmount: number): FeeRow["status"] {
    const total = Number(row.totalPayable ?? row.amount) || 0;
    const paid = (Number(row.paidAmount ?? 0) || 0) + addAmount;
    if (paid >= total && total > 0) return "PAID";
    if (paid > 0) return "PARTIAL";
    return row.status;
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paying) return;
    const amount = Number(payAmount) || 0;
    if (amount <= 0) {
      setPayError("Enter an amount greater than 0.");
      toastError("Invalid amount", "Enter an amount greater than 0.");
      return;
    }
    // PATCH /fees/:id/payment — owner/admin only (backend enforces role).
    // Status is NOT sent — backend derives it from paidAmount vs totalPayable.
    setIsPaying(true);
    setPayError(null);
    try {
      const res = await hostelGhar.fees.recordPayment(paying.id, {
        amount,
        method: payMethod as "CASH" | "ESEWA" | "KHALTI" | "BANK",
      });
      const payload = unwrap<Fee | null>(res.data);
      if (payload) {
        const roomById = new Map(residents.map((r) => [r.id, r.roomNumber]));
        const nameById = new Map(residents.map((r) => [r.id, r.name]));
        const updated = feeToRow(payload, roomById, nameById);
        setServerFees((prev) => (prev ?? []).map((f) => (f.id === updated.id ? updated : f)));
        setPaying(null);
        success(
          "Payment recorded",
          `${updated.residentName} is now ${updated.status} · paid ${formatCurrency(Number(updated.paidAmount ?? amount))}`
        );
      } else if (hostelId) {
        setServerFees(await refreshFees(hostelId, statusFilter || undefined));
        setPaying(null);
        success("Payment recorded", `${formatCurrency(amount)} · ${payMethod}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Try again.";
      setPayError(message);
      toastError("Couldn't record payment", message);
    } finally {
      setIsPaying(false);
    }
  }

  const columns: Column<FeeRow>[] = [
    {
      key: "residentName",
      header: "Resident",
      sortable: true,
      render: (f) => (
        <span>
          <span className="block font-semibold">{f.residentName}</span>
          <span className="block text-xs text-neutral-500">
            {f.residentId ? `ID: ${f.residentId} · ` : ""}Room {f.roomNumber || "—"}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Payable",
      sortable: true,
      render: (f) => (
        <span>
          <span className="block font-bold">{formatCurrency(Number(f.totalPayable ?? f.amount))}</span>
          <span className="block text-xs text-neutral-500">
            base {formatCurrency(f.amount)}
            {f.dueAmount ? ` + due ${formatCurrency(f.dueAmount)}` : ""}
            {f.paidAmount ? ` · paid ${formatCurrency(f.paidAmount)}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "billingMonth",
      header: "Billing",
      sortable: true,
      render: (f) => (
        <span>
          <span className="block font-medium">{billingLabel(f.billingMonth, f.billingYear)}</span>
          <span className="block text-xs text-neutral-500">{f.feeType ?? "MONTHLY_HOSTEL_FEE"}</span>
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Due date",
      sortable: true,
      render: (f) => <span>{f.dueDate ? formatDate(f.dueDate) : "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (f) => <Badge tone={statusTone(f.status)}>{f.status}</Badge>,
    },
    {
      key: "receipt",
      header: "Receipt",
      render: (f) => {
        const proof = proofByFee.get(String(f.id));
        if (!proof) return <span className="text-xs text-neutral-400">—</span>;
        return <Badge tone={proofStatusTone(proof.status)}>{proofStatusLabel(proof.status)}</Badge>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (f) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openPayModal(f)}
          disabled={f.status === "PAID"}
        >
          Record payment
        </Button>
      ),
    },
  ];

  return (
    <DashboardShell title="Fees" subtitle="Hostel Ghar / Finance / Fees — monthly charges and collection status.">
      <Protected permission="MANAGE_PAYMENTS" redirectTo="/dashboard">
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Collected", totals.paid, "cash in ledger"],
            ["Pending", totals.pending, "awaiting payment"],
            ["Overdue", totals.overdue, "needs follow-up"],
          ].map(([label, value, hint]) => (
            <Card key={label} className="p-4">
              <p className="text-[13px] text-neutral-500">{label}</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(Number(value))}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>
            </Card>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            {isLoading
              ? "Loading owner data…"
              : `${residents.length} residents · ${rooms.length} rooms · ${fees.length} fees`}
            {usingFallback && !isLoading && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                offline preview
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2" role="group" aria-label="Filter by status">
              {(["", "PENDING", "PARTIAL", "PAID", "OVERDUE"] as const).map((s) => (
                <button
                  key={s || "all"}
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={statusFilter === s}
                  className={
                    statusFilter === s
                      ? "rounded-full bg-brand-ink px-3 py-1 text-xs font-semibold text-brand"
                      : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600"
                  }
                >
                  {s || "All"}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => void handleGenerateMonthly()}
              loading={isGenerating}
              disabled={!hostelId}
              title={hostelId ? "POST /fees/generate-monthly" : "Link a hostel first"}
            >
              Generate Monthly Fees
            </Button>
          </div>
        </div>

        {paying && (
          <Card className="mb-4 border-brand-ink p-5">
            <form onSubmit={handleRecordPayment} className="grid gap-4 sm:grid-cols-4" noValidate>
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold">{paying.residentName}</p>
                <p className="text-xs text-neutral-500">
                  Room {paying.roomNumber || "—"} · Payable{" "}
                  {formatCurrency(Number(paying.totalPayable ?? paying.amount))} · Paid{" "}
                  {formatCurrency(Number(paying.paidAmount ?? 0))} · Now{" "}
                  <span className="font-semibold text-neutral-800">{paying.status}</span>
                  {" → "}
                  <span className="font-semibold text-neutral-900">
                    {previewStatus(paying, Number(payAmount) || 0)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Status is set by backend from paid vs payable — pay full{" "}
                  {formatCurrency(Number(paying.totalPayable ?? paying.amount))} to reach PAID.
                </p>
              </div>
              <Input
                label="Amount (Rs.)"
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
              <div>
                <label htmlFor="fee-pay-method" className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                  Method
                </label>
                <select
                  id="fee-pay-method"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className={selectClass}
                >
                  <option value="CASH">Cash</option>
                  <option value="ESEWA">eSewa</option>
                  <option value="KHALTI">Khalti</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div className="sm:col-span-4 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setPaying(null)} disabled={isPaying}>
                  Cancel
                </Button>
                <Button type="submit" loading={isPaying}>
                  Save payment
                </Button>
              </div>
            </form>
            {payError && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {payError} — check DevTools Network: PATCH /fees/{paying.id}/payment must return 200 with the updated Fee.
              </p>
            )}
          </Card>
        )}

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : fees.length === 0 ? (
          <EmptyState
            title={hostelId ? "No fees yet" : "No hostel linked"}
            description={
              hostelId
                ? loadError
                  ? `Backend ledger failed to load: ${loadError} — check DevTools Network for GET /fees/hostels/${hostelId}.`
                  : `No bills found for this hostel yet. Click "Generate Monthly Fees" to run POST /fees/generate-monthly { hostelId: "${hostelId ?? ""}" } for your ${residents.length} residents, then record payments per row.`
                : "Link your account to a hostel to see its ledger."
            }
            action={
              hostelId && !loadError ? (
                <Button
                  onClick={() => void handleGenerateMonthly()}
                  loading={isGenerating}
                >
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
            searchableKeys={["residentName", "roomNumber", "residentId"]}
            searchPlaceholder="Search fees…"
            mobileCard={(f) => (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{f.residentName}</p>
                  <p className="text-xs text-neutral-500">
                    Room {f.roomNumber || "—"} · {formatCurrency(f.amount)}
                  </p>
                </div>
                <Badge tone={statusTone(f.status)}>{f.status}</Badge>
              </div>
            )}
          />
        )}

        {/* Resident QR receipts — review proof, approve flips fee to PAID */}
        <div className="mt-6">
          <PaymentProofReview
            proofs={proofs}
            isLoading={proofsLoading}
            onChanged={() => {
              void refetchProofs();
              if (hostelId) {
                void refreshFees(hostelId, statusFilter || undefined)
                  .then((rows) => setServerFees(rows))
                  .catch(() => undefined);
              }
            }}
          />
          {pendingCount === 0 && proofs.length === 0 && (
            <p className="mt-2 text-xs text-neutral-400">
              No receipts yet — residents upload QR payment screenshots from My Payments → Upload receipt.
            </p>
          )}
        </div>
      </Protected>
    </DashboardShell>
  );
}
