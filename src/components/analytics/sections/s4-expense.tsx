"use client";
import { useMemo, useState } from "react";
import { ChartShell } from "../chart-core";
import { HBarList } from "../chart-parts";
import { Insight } from "../chart-misc";
import { Segmented } from "../charts";
import { downloadCSV, toCSV, type AnalyticsBase } from "@/lib/analytics";
import { expensesByCategory } from "@/lib/analytics-ops";
import { formatCurrency } from "@/lib/utils";
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
export function ExpenseSection({ base }: { base: AnalyticsBase }) {
  const [m, setM] = useState("Sep");
  const rows = useMemo(() => expensesByCategory(base, m), [base, m]);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return (
    <ChartShell title="Expenses by category" subtitle={`${formatCurrency(total)} in ${m} · sorted high to low`}
      filters={<Segmented label="Expense month" value={m} onChange={setM} options={MONTHS.map((x) => ({ value: x, label: x }))} />}
      onExport={() => downloadCSV(`expenses-${m}.csv`, toCSV(["category", "amount", "share"], rows.map((r) => [r.category, r.amount, r.share])))}
      footer={<p>Staff + food is typically ~45% of hostel opex — benchmark before cutting.</p>}>
      <HBarList rows={rows.map((r) => ({ label: r.category, value: r.amount, sub: `${r.share}%` }))} formatV={(v) => formatCurrency(v)} />
      <Insight tone="warn" title={`${rows[0].category} leads spend at ${formatCurrency(rows[0].amount)}.`} body="Compare against last month before approving new purchase orders." />
    </ChartShell>
  );
}
