"use client";
import { useMemo, useState } from "react";
import { ChartShell } from "../chart-core";
import { HBarList } from "../chart-parts";
import { Insight } from "../chart-misc";
import { downloadCSV, toCSV, type AnalyticsBase } from "@/lib/analytics";
import {
  expenseAmount,
  expenseCategoryLabel,
  expenseTotal,
  groupExpensesByMonth,
} from "@/lib/analytics-live";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
/**
 * Owner-scoped expense breakdown — derived ONLY from GET /expenses
 * (owner hostels). No seeded category split: empty ledger → empty state.
 */
export function ExpenseSection({ base }: { base: AnalyticsBase }) {
  const expenses = useMemo(() => base.expenses ?? [], [base.expenses]);
  const months = useMemo(() => groupExpensesByMonth(expenses).slice(-8), [expenses]);
  const keys = useMemo(() => months.map((m) => m.label), [months]);
  const [sel, setSel] = useState<string | null>(null);
  const active = sel ?? (keys.length > 0 ? keys[keys.length - 1] : null);
  const activeMonth = months.find((m) => m.label === active);
  const rows = useMemo(() => {
    if (!activeMonth) return [];
    const inMonth = expenses.filter((e) => {
      const raw = e.expenseDate || e.date || e.createdAt || "";
      const d = raw ? new Date(raw) : null;
      return (
        d &&
        !Number.isNaN(d.getTime()) &&
        d.getFullYear() === activeMonth.y &&
        d.getMonth() + 1 === activeMonth.m
      );
    });
    const byCat = new Map<string, number>();
    for (const e of inMonth) {
      const k = expenseCategoryLabel(String(e.category ?? "OTHER"));
      byCat.set(k, (byCat.get(k) ?? 0) + expenseAmount(e));
    }
    const total = [...byCat.values()].reduce((a, b) => a + b, 0);
    return [...byCat.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        share: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, activeMonth]);
  const periodTotal = activeMonth ? activeMonth.total : expenseTotal(expenses);
  const firstRow = rows[0];
  if (expenses.length === 0) {
    return (
      <ChartShell title="Expenses by category" subtitle="No expenses recorded">
        <EmptyState
          title="No expenses yet"
          description="Record hostel costs on the Expenses page to see the breakdown here."
        />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title="Expenses by category"
      subtitle={`${formatCurrency(periodTotal)}${activeMonth ? ` in ${activeMonth.label}` : ""} · live from expenses`}
      filters={
        keys.length > 1 ? (
          <div
            className="inline-flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5"
            role="group"
            aria-label="Expense month"
          >
            {keys.map((k) => (
              <button
                key={k}
                onClick={() => setSel(k)}
                aria-pressed={active === k}
                className={
                  active === k
                    ? "h-7 rounded-md bg-brand-ink px-2.5 text-xs font-semibold text-brand"
                    : "h-7 rounded-md px-2.5 text-xs font-semibold text-neutral-500"
                }
              >
                {k}
              </button>
            ))}
          </div>
        ) : undefined
      }
      onExport={() =>
        downloadCSV(
          `expenses-${active ?? "all"}.csv`,
          toCSV(
            ["category", "amount", "share"],
            rows.map((r) => [r.category, r.amount, r.share])
          )
        )
      }
      footer={<p className="text-xs text-neutral-400">Recorded expenses for your hostels.</p>}
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No expenses this month"
          description="No expense rows fall in this month."
        />
      ) : firstRow ? (
        <>
          <HBarList
            rows={rows.map((r) => ({ label: r.category, value: r.amount, sub: `${r.share}%` }))}
            formatV={(v) => formatCurrency(v)}
          />
          <Insight
            tone="info"
            title={`${firstRow.category} leads spend at ${formatCurrency(firstRow.amount)}.`}
            body="Compare against last month before approving new purchase orders."
          />
        </>
      ) : (
        <EmptyState
          title="No expenses this month"
          description="No expense rows fall in this month."
        />
      )}
    </ChartShell>
  );
}
