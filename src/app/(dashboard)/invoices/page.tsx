"use client";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId, toApiError } from "@/lib/axios";
import {
  hostelGhar,
  invoiceMonthLabel,
  normalizeInvoiceList,
  normalizeResident,
  splitBillingMonthInput,
  toPaginated,
  unwrap,
  validHostelId,
} from "@/lib/hostelGhar";
import type { Invoice } from "@/lib/api-types";
import type { Resident } from "@/types/resident";
import {
  CreateInvoiceModal,
  type NewInvoicePayload,
} from "@/components/finance/CreateInvoiceModal";

export default function InvoicesPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [residentsLoading, setResidentsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setResidentsLoading(true);
    setLoadError(null);
    try {
      const hid =
        validHostelId(user?.hostelId) ??
        validHostelId(getHostelId()) ??
        (await hostelGhar.owner
          .residents({ limit: 1 })
          .then((r) => toPaginated<unknown>(unwrap<unknown>(r.data)).items[0])
          .then((first) => {
            const rec = (first ?? {}) as Record<string, unknown>;
            const v = rec.hostelId ?? rec.hostel_id;
            return typeof v === "string" ? v : null;
          })
          .catch(() => null));
      if (!hid) {
        setHostelId(null);
        setInvoices([]);
        setResidents([]);
        return;
      }
      setHostelId(hid);
      // Residents of the related hostel (name + gmail dropdown source).
      try {
        const res = await hostelGhar.owner.residents({ hostelId: hid, limit: 500 });
        setResidents(toPaginated<unknown>(unwrap<unknown>(res.data)).items.map(normalizeResident));
      } catch {
        try {
          const res = await hostelGhar.hostels.residents(hid);
          setResidents(
            toPaginated<unknown>(unwrap<unknown>(res.data)).items.map(normalizeResident)
          );
        } catch {
          setResidents([]);
        }
      } finally {
        setResidentsLoading(false);
      }
      // Invoice ledger (dedicated route → fee-ledger fallback, same rows).
      const res = await hostelGhar.invoices.list({ hostelId: hid, limit: 100 });
      setInvoices(normalizeInvoiceList(unwrap<unknown>(res.data)));
    } catch (err) {
      setLoadError(toApiError(err).message);
      setInvoices([]);
    } finally {
      setIsLoading(false);
      setResidentsLoading(false);
    }
  }, [user?.hostelId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function createInvoice(payload: NewInvoicePayload) {
    const hid = validHostelId(payload.hostelId) ?? hostelId;
    if (!hid) {
      setModalError("Link your account to a hostel first.");
      return;
    }
    const split = splitBillingMonthInput(payload.billingMonth);
    if (!split) {
      setModalError("Billing month must look like 2026-09.");
      return;
    }
    const residentName = String(payload.residentName ?? "").trim();
    if (residentName.length < 2) {
      setModalError("Resident name must be at least 2 characters.");
      return;
    }
    setIsSaving(true);
    setModalError(null);
    try {
      // POST /fees/invoices — normalizeInvoiceFields + CreateInvoiceDto
      // (residentName is required: 2–200 chars).
      await hostelGhar.invoices.create({
        hostelId: hid,
        residentId: payload.residentId,
        residentName: residentName.slice(0, 200),
        residentEmail: payload.residentEmail,
        amount: Number(payload.amount),
        billingMonth: split.month,
        billingYear: split.year,
        dueDate: payload.dueDate,
        status: payload.status,
      });
      setCreateOpen(false);
      success("Invoice created", `Invoice for ${payload.residentName} was recorded.`);
      await loadAll();
    } catch (err) {
      const msg = toApiError(err).message;
      setModalError(msg);
      toastError("Couldn't create invoice", msg);
    } finally {
      setIsSaving(false);
    }
  }

  const residentEmailById = new Map(residents.map((r) => [r.id, r.email]));
  const residentNameById = new Map(residents.map((r) => [r.id, r.name]));

  const columns: Column<Invoice>[] = [
    {
      key: "id",
      header: "Invoice #",
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs font-bold text-neutral-900">
          {(r.invoiceNumber as string) || `INV-${String(r.id).slice(0, 8)}`}
        </span>
      ),
    },
    {
      key: "resident",
      header: "Resident",
      sortable: true,
      render: (r) => {
        const rid = typeof r.residentId === "string" ? r.residentId : "";
        const nested =
          r.resident && typeof r.resident === "object"
            ? (r.resident as { name?: unknown; email?: unknown })
            : null;
        const name =
          (typeof r.residentName === "string" && r.residentName) ||
          (typeof nested?.name === "string" && nested.name) ||
          (rid ? (residentNameById.get(rid) ?? "Resident") : "Resident");
        const email =
          (typeof r.residentEmail === "string" && r.residentEmail) ||
          (typeof nested?.email === "string" && nested.email) ||
          (rid ? (residentEmailById.get(rid) ?? "") : "");
        return (
          <span>
            <span className="block font-bold text-neutral-900">{name}</span>
            <span className="block text-xs font-semibold text-neutral-600">
              {email || "no email"} · {invoiceMonthLabel(r.billingMonth, r.billingYear)}
            </span>
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Payable / Outstanding",
      sortable: true,
      render: (r) => {
        const total = Number(r.totalPayable ?? r.amount ?? 0);
        const paid = Number(r.paidAmount ?? 0);
        const outstanding =
          r.outstandingAmount !== undefined
            ? Number(r.outstandingAmount)
            : Math.max(0, total - paid);
        return (
          <div>
            <span className="font-bold text-neutral-900">{formatCurrency(total)}</span>
            {outstanding > 0 && paid > 0 && (
              <span className="block text-xs font-bold text-rose-600">
                Due: {formatCurrency(outstanding)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => {
        const st = String(r.status ?? "PENDING").toUpperCase();
        const display = st === "PARTIALLY_PAID" ? "PARTIAL" : st;
        return <Badge tone={statusTone(display)}>{display}</Badge>;
      },
    },
  ];
  return (
    <DashboardShell title="Invoices" subtitle="Hostel Ghar / Finance / Invoices">
      <Protected permission="MANAGE_INVOICES" redirectTo="/fees">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {isLoading
              ? "Loading invoices…"
              : hostelId
                ? `${invoices.length} invoices · ${residents.length} hostel residents`
                : "Link your account to a hostel to bill its residents."}
          </p>
          <Button onClick={() => setCreateOpen(true)} disabled={!hostelId || isLoading}>
            New Invoice
          </Button>
        </div>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : loadError && invoices.length === 0 ? (
          <ErrorState
            title="Couldn't load invoices"
            description={`${loadError} — check DevTools Network for GET /fees/invoices.`}
            onRetry={() => void loadAll()}
          />
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description={
              hostelId
                ? "Pick a hostel resident (name + Gmail) and click New Invoice to record POST /fees/invoices."
                : "Link your account to a hostel to see its invoices."
            }
            action={
              hostelId ? (
                <Button onClick={() => setCreateOpen(true)}>New Invoice</Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable<Invoice>
            columns={columns}
            rows={invoices}
            rowKey={(r) => String(r.id)}
            searchableKeys={["residentName", "id", "status"]}
            searchPlaceholder="Search invoices…"
            mobileCard={(r) => (
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-neutral-900">
                    {String(r.residentName ?? r.id)}
                  </span>
                  <span className="block text-xs font-semibold text-neutral-600">
                    {String(r.id)} · {formatCurrency(Number(r.amount ?? 0))}
                  </span>
                </span>
                <Badge tone={statusTone(String(r.status ?? ""))}>{String(r.status ?? "")}</Badge>
              </div>
            )}
          />
        )}
        <CreateInvoiceModal
          open={createOpen}
          onClose={() => {
            setCreateOpen(false);
            setModalError(null);
          }}
          onSubmit={(p) => void createInvoice(p)}
          isSaving={isSaving}
          serverError={modalError}
          residents={residents}
          residentsLoading={residentsLoading}
        />
      </Protected>
    </DashboardShell>
  );
}
