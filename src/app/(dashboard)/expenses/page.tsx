"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";

interface ExpenseRow {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  status: string;
}

const EXPENSES: ExpenseRow[] = [
  {
    id: "e-1",
    title: "Groceries — mess",
    category: "Food",
    amount: 86000,
    date: "2026-09-04",
    status: "PAID",
  },
  {
    id: "e-2",
    title: "Electricity bill",
    category: "Utilities",
    amount: 18500,
    date: "2026-09-02",
    status: "PAID",
  },
  {
    id: "e-3",
    title: "Plumbing repair F2",
    category: "Maintenance",
    amount: 6500,
    date: "2026-08-30",
    status: "PENDING",
  },
  {
    id: "e-4",
    title: "WiFi — Worldlink",
    category: "Utilities",
    amount: 3200,
    date: "2026-09-01",
    status: "PAID",
  },
];

export default function ExpensesPage() {
  const { success } = useToast();
  const columns: Column<ExpenseRow>[] = [
    {
      key: "title",
      header: "Expense",
      sortable: true,
      render: (e) => (
        <span>
          <span className="block font-semibold">{e.title}</span>
          <span className="block text-xs text-neutral-500">
            {e.category} · {formatDate(e.date)}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (e) => <span className="font-bold">{formatCurrency(e.amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (e) => <Badge tone={e.status === "PAID" ? "green" : "amber"}>{e.status}</Badge>,
    },
  ];
  return (
    <DashboardShell title="Expenses" subtitle="Hostel Ghar / Finance / Expenses">
      <Protected permission="MANAGE_EXPENSES" redirectTo="/dashboard">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => success("Expense saved", "Added to September books.")}>
            Add Expense
          </Button>
        </div>
        <DataTable<ExpenseRow>
          columns={columns}
          rows={EXPENSES}
          rowKey={(e) => e.id}
          searchableKeys={["title", "category"]}
          searchPlaceholder="Search expenses…"
          mobileCard={(e) => (
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{e.title}</span>
                <span className="block text-xs text-neutral-500">{formatCurrency(e.amount)}</span>
              </span>
              <Badge tone={e.status === "PAID" ? "green" : "amber"}>{e.status}</Badge>
            </div>
          )}
        />
      </Protected>
    </DashboardShell>
  );
}
