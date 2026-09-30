"use client";
import { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { CreateInvoiceModal, type NewInvoicePayload } from "@/components/finance/CreateInvoiceModal";

interface InvoiceRow {
  id: string;
  resident: string;
  month: string;
  amount: number;
  status: string;
}

const INVOICES: InvoiceRow[] = [
  { id: "i-101", resident: "Sita Karki", month: "Sep 2026", amount: 12500, status: "SENT" },
  { id: "i-102", resident: "Bibek Thapa", month: "Aug 2026", amount: 11000, status: "OVERDUE" },
  { id: "i-103", resident: "Pooja Maharjan", month: "Sep 2026", amount: 12500, status: "DRAFT" },
];

export default function InvoicesPage() {
  const { success } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  function createInvoice(payload: NewInvoicePayload) {
    console.info("[Hostel Ghar] New invoice", payload);
    setCreateOpen(false);
    success("Invoice ready", "The invoice form data was logged to the console.");
  }
  const columns: Column<InvoiceRow>[] = [
    {
      key: "id",
      header: "Invoice",
      sortable: true,
      render: (r) => <span className="font-semibold">{r.id}</span>,
    },
    {
      key: "resident",
      header: "Resident",
      sortable: true,
      render: (r) => (
        <span>
          <span className="block font-medium">{r.resident}</span>
          <span className="block text-xs text-neutral-500">{r.month}</span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (r) => <span className="font-bold">{formatCurrency(r.amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
    },
  ];
  return (
    <DashboardShell title="Invoices" subtitle="Hostel Ghar / Finance / Invoices">
      <Protected permission="MANAGE_INVOICES" redirectTo="/fees">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>New Invoice</Button>
        </div>
        <DataTable<InvoiceRow>
          columns={columns}
          rows={INVOICES}
          rowKey={(r) => r.id}
          searchableKeys={["resident", "id", "status"]}
          searchPlaceholder="Search invoices…"
          mobileCard={(r) => (
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.resident}</span>
                <span className="block text-xs text-neutral-500">
                  {r.id} · {formatCurrency(r.amount)}
                </span>
              </span>
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            </div>
          )}
        />
        <CreateInvoiceModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSubmit={createInvoice}
        />
      </Protected>
    </DashboardShell>
  );
}
