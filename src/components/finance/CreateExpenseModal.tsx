"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getHostelId, toApiError } from "@/lib/axios";
import type { Expense } from "@/lib/api-types";

const fieldClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand";
const labelClass = "mb-1.5 block text-[13px] font-medium text-neutral-800";

export interface NewExpensePayload {
  hostelId: string | null;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  status: "PAID" | "PENDING";
  notes: string;
}

export function CreateExpenseModal({
  open,
  onClose,
  onSubmit,
  editing,
  isSaving,
  serverError,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewExpensePayload) => Promise<boolean> | boolean | void;
  /** When set, the modal edits instead of creates (`hostelId` stays immutable). */
  editing?: Expense | null;
  isSaving?: boolean;
  serverError?: string | null;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (open) {
      setFormError(null);
      setFormKey((k) => k + 1);
    }
  }, [open, editing?.id]);

  function toDateInput(value?: string | null): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().slice(0, 10);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const amount = Number(form.get("amount") ?? 0);
    const expenseDate = String(form.get("expenseDate") ?? "");
    if (!title) {
      setFormError("Expense title is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Amount must be greater than 0.");
      return;
    }
    if (!expenseDate) {
      setFormError("Expense date is required.");
      return;
    }
    const ok = await onSubmit({
      hostelId: getHostelId(),
      title,
      category: String(form.get("category") ?? "OTHER"),
      amount,
      expenseDate,
      status: String(form.get("status") ?? "PAID") as NewExpensePayload["status"],
      notes: String(form.get("notes") ?? "").trim(),
    });
    if (ok === false) return;
    event.currentTarget.reset();
  }

  const initial = editing
    ? {
        title: editing.title ?? "",
        category: String(editing.category ?? "OTHER"),
        amount: String(editing.amount ?? ""),
        expenseDate: toDateInput(editing.expenseDate ?? editing.date),
        status: editing.status ?? "PAID",
        notes: editing.notes ?? "",
      }
    : null;
  const apiError = serverError ? toApiError(serverError).message : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit expense" : "Add expense"}
      description={
        editing
          ? "Update title, category, amount, date, notes, or status. Hostel can't be changed."
          : "Record a hostel cost for your finance records."
      }
    >
      <form
        key={`${editing?.id ?? "new"}-${formKey}`}
        onSubmit={(e) => void handleSubmit(e)}
        className="grid gap-4"
      >
        <Input
          label="Expense title"
          name="title"
          placeholder="e.g. Electricity bill"
          defaultValue={initial?.title}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="expense-category" className={labelClass}>
              Category <span className="text-red-600">*</span>
            </label>
            <select
              id="expense-category"
              name="category"
              defaultValue={initial?.category ?? "UTILITIES"}
              className={fieldClass}
            >
              <option value="FOOD">Food & mess</option>
              <option value="UTILITIES">Utilities</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="SALARIES">Salaries</option>
              <option value="SUPPLIES">Supplies</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <Input
            label="Amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={initial?.amount}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="expense-date" className={labelClass}>
              Expense date <span className="text-red-600">*</span>
            </label>
            <input
              id="expense-date"
              name="expenseDate"
              type="date"
              required
              defaultValue={initial?.expenseDate}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="expense-status" className={labelClass}>
              Payment status <span className="text-red-600">*</span>
            </label>
            <select
              id="expense-status"
              name="status"
              defaultValue={initial?.status ?? "PAID"}
              className={fieldClass}
            >
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="expense-notes" className={labelClass}>
            Notes <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <textarea
            id="expense-notes"
            name="notes"
            rows={3}
            defaultValue={initial?.notes ?? ""}
            placeholder="Add a vendor, receipt number, or context."
            className="w-full resize-y rounded-md border border-surface-border bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-brand-ink focus:ring-2 focus:ring-brand"
          />
        </div>
        {(formError || apiError) && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {formError ?? apiError}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {editing ? "Save changes" : "Add expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
