"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useDomainSocket } from "@/hooks/useDomainSocket";
import { getHostelId, toApiError } from "@/lib/axios";
import {
  hostelGhar,
  normalizeExpense,
  normalizeExpenseList,
  normalizeExpensePagination,
  unwrap,
  validHostelId,
} from "@/lib/hostelGhar";
import type {
  CreateExpensePayload as ApiCreateExpensePayload,
  Expense,
  ExpenseListParams,
  ExpensePagination,
} from "@/lib/api-types";
import { CreateExpenseModal, type NewExpensePayload } from "@/components/finance/CreateExpenseModal";

const PAGE_SIZE = 20;

const selectClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand";

function expenseDateOf(e: Expense): string {
  return e.expenseDate || e.date || e.createdAt || "";
}

function expenseAmountOf(e: Expense): number {
  const n = typeof e.amount === "string" ? Number(e.amount) : e.amount;
  return Number.isFinite(n as number) ? Number(n) : 0;
}

function errorMessage(err: unknown, fallback: string): string {
  const shape = toApiError(err);
  return shape.message || fallback;
}

export default function ExpensesPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pagination, setPagination] = useState<ExpensePagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const hostelId = validHostelId(getHostelId() ?? user?.hostelId) ?? null;
  const isAdmin = user?.role === "SUPER_ADMIN";

  const loadExpenses = useCallback(
    async (targetPage = page, category = categoryFilter, status = statusFilter) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const params: ExpenseListParams = { page: targetPage, limit: PAGE_SIZE };
        if (hostelId) params.hostelId = hostelId;
        if (category) params.category = category;
        if (status) params.status = status;
        const res = await hostelGhar.expenses.list(params);
        const items = normalizeExpenseList(res.data);
        setExpenses(items);
        const pag = normalizeExpensePagination(res.data, PAGE_SIZE);
        if (pag.totalItems === 0 && items.length > 0) pag.totalItems = items.length;
        setPagination({ ...pag, currentPage: targetPage });
      } catch (err) {
        setLoadError(errorMessage(err, "Couldn't load expenses."));
      } finally {
        setIsLoading(false);
      }
    },
    [page, categoryFilter, statusFilter, hostelId]
  );

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  useDomainSocket({
    userId: user?.id,
    role: user?.role,
    hostelId,
    onEvent: () => {
      void loadExpenses();
    },
  });

  const totals = useMemo(() => {
    const paid = expenses
      .filter((e) => e.status === "PAID")
      .reduce((sum, e) => sum + expenseAmountOf(e), 0);
    const pending = expenses
      .filter((e) => e.status !== "PAID")
      .reduce((sum, e) => sum + expenseAmountOf(e), 0);
    return { paid, pending, total: paid + pending, count: pagination?.totalItems ?? 0 };
  }, [expenses, pagination]);

  async function handleCreate(payload: NewExpensePayload): Promise<boolean> {
    const hid = validHostelId(payload.hostelId ?? hostelId) ?? hostelId;
    if (!hid && !isAdmin) {
      const msg = "No hostel linked — link your account to a hostel first.";
      setModalError(msg);
      toastError("No hostel linked", msg);
      return false;
    }
    setIsSaving(true);
    setModalError(null);
    try {
      const body: ApiCreateExpensePayload = {
        hostelId: (hid ?? "") as string,
        title: payload.title,
        category: payload.category,
        amount: payload.amount,
        expenseDate: payload.expenseDate,
        notes: payload.notes || undefined,
        status: payload.status,
      };
      if (!hid) delete (body as Partial<ApiCreateExpensePayload>).hostelId;
      const res = await hostelGhar.expenses.create(body);
      const created = normalizeExpense(unwrap<unknown>(res.data));
      setCreateOpen(false);
      success("Expense created", `${created.title || "Expense"} was recorded.`);
      setPage(1);
      void loadExpenses(1, categoryFilter, statusFilter);
      return true;
    } catch (err) {
      const msg = errorMessage(err, "Couldn't create the expense.");
      setModalError(msg);
      toastError("Couldn't create expense", msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }
  async function handleUpdate(payload: NewExpensePayload): Promise<boolean> {
    if (!editing) return false;
    setIsSaving(true);
    setModalError(null);
    try {
      const body = {
        title: payload.title,
        category: payload.category,
        amount: payload.amount,
        expenseDate: payload.expenseDate,
        notes: payload.notes || undefined,
        status: payload.status,
      };
      const res = await hostelGhar.expenses.patch(editing.id, body);
      const raw = unwrap<unknown>(res.data);
      const updated = normalizeExpense(
        raw && typeof raw === "object" ? raw : { ...editing, ...body }
      );
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
      setEditing(null);
      success("Expense updated", `${updated.title || "Expense"} was saved.`);
      return true;
    } catch (err) {
      const msg = errorMessage(err, "Couldn't update the expense.");
      setModalError(msg);
      toastError("Couldn't update expense", msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await hostelGhar.expenses.remove(deleting.id);
      setExpenses((prev) => prev.filter((e) => e.id !== deleting.id));
      success("Expense deleted", `${deleting.title || "Expense"} was removed.`);
      setDeleting(null);
      void loadExpenses(page, categoryFilter, statusFilter);
    } catch (err) {
      toastError("Couldn't delete expense", errorMessage(err, "Delete failed."));
    } finally {
      setIsDeleting(false);
    }
  }

  function resetFilters(): void {
    setCategoryFilter("");
    setStatusFilter("");
    setPage(1);
  }

  const columns: Column<Expense>[] = [
    {
      key: "title",
      header: "Expense",
      sortable: true,
      render: (e) => (
        <span>
          <span className="block font-semibold">{e.title}</span>
          <span className="block text-xs text-neutral-500">
            {e.category} · {formatDate(expenseDateOf(e))}
            {e.notes ? ` · ${e.notes}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (e) => <span className="font-bold">{formatCurrency(expenseAmountOf(e))}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (e) => <Badge tone={statusTone(e.status)}>{e.status}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (e) => (
        <span className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setModalError(null);
              setEditing(e);
            }}
          >
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleting(e)}>
            Delete
          </Button>
        </span>
      ),
    },
  ];
  return (
    <DashboardShell title="Expenses" subtitle="Hostel Ghar / Finance / Expenses">
      <Protected permission="MANAGE_EXPENSES" redirectTo="/dashboard">
        <div className="mb-4 grid gap-3 rounded-card border border-surface-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="expense-filter-category" className="mb-1 block text-xs text-neutral-500">
              Category
            </label>
            <select
              id="expense-filter-category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className={selectClass}
            >
              <option value="">All categories</option>
              <option value="FOOD">Food & mess</option>
              <option value="UTILITIES">Utilities</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="SALARIES">Salaries</option>
              <option value="SUPPLIES">Supplies</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="expense-filter-status" className="mb-1 block text-xs text-neutral-500">
              Status
            </label>
            <select
              id="expense-filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={selectClass}
            >
              <option value="">All statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={resetFilters} className="w-full">
              Reset
            </Button>
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => {
                setModalError(null);
                setCreateOpen(true);
              }}
              className="w-full"
            >
              Add Expense
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-card border border-surface-border bg-white p-4">
            <p className="mt-1 text-lg font-bold">{formatCurrency(totals.total)}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{totals.count} records</p>
          </div>
          <div className="rounded-card border border-surface-border bg-white p-4">
            <p className="text-xs text-neutral-500">Paid</p>
            <p className="mt-1 text-lg font-bold text-green-700">{formatCurrency(totals.paid)}</p>
          </div>
          <div className="rounded-card border border-surface-border bg-white p-4">
            <p className="text-xs text-neutral-500">Pending</p>
            <p className="mt-1 text-lg font-bold text-amber-700">{formatCurrency(totals.pending)}</p>
          </div>
        </div>

        {!hostelId && !isAdmin && (
          <p role="status" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
            No hostel linked — connect this account to a hostel to load its expenses.
          </p>
        )}
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : loadError ? (
          <ErrorState
            title="Couldn't load expenses"
            description={`${loadError} — check DevTools Network for GET /expenses.`}
            onRetry={() => void loadExpenses(page, categoryFilter, statusFilter)}
          />
        ) : expenses.length === 0 ? (
          <EmptyState
            title={hostelId || isAdmin ? "No expenses yet" : "No hostel linked"}
            description={
              hostelId || isAdmin
                ? "No expenses match these filters yet. Click Add Expense to record POST /expenses."
                : "Link your account to a hostel to see its expenses."
            }
          />
        ) : (
          <>
            <DataTable<Expense>
              columns={columns}
              rows={expenses}
              rowKey={(e) => e.id}
              searchableKeys={["title", "category"]}
              searchPlaceholder="Search expenses…"
              mobileCard={(e) => (
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{e.title}</span>
                    <span className="block text-xs text-neutral-500">
                      {formatCurrency(expenseAmountOf(e))} · {formatDate(expenseDateOf(e))}
                    </span>
                  </span>
                  <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                </div>
              )}
            />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between rounded-card border border-surface-border bg-white px-4 py-3">
                <p className="text-xs text-neutral-500" role="status">
                  Page {pagination.currentPage} of {pagination.totalPages} · {pagination.totalItems}{" "}
                  records
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        <CreateExpenseModal
          open={createOpen}
          onClose={() => {
            setCreateOpen(false);
            setModalError(null);
          }}
          onSubmit={(p) => handleCreate(p)}
          isSaving={isSaving}
          serverError={modalError}
        />
        <CreateExpenseModal
          open={editing !== null}
          onClose={() => {
            setEditing(null);
            setModalError(null);
          }}
          onSubmit={(p) => handleUpdate(p)}
          editing={editing}
          isSaving={isSaving}
          serverError={modalError}
        />
        <Modal
          open={deleting !== null}
          onClose={() => setDeleting(null)}
          title="Delete expense"
          description={`Remove ${deleting?.title ?? "this expense"}? This calls DELETE /expenses/:id.`}
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} loading={isDeleting}>
              Delete expense
            </Button>
          </div>
        </Modal>
      </Protected>
    </DashboardShell>
  );
}
