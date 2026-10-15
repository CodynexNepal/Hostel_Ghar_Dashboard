"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getHostelId } from "@/lib/axios";
import type { Resident } from "@/types/resident";

const fieldClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand";
const labelClass = "mb-1.5 block text-[13px] font-medium text-neutral-800";

export interface NewInvoicePayload {
  hostelId: string | null;
  /** Backend id of the picked hostel resident. */
  residentId: string;
  residentName: string;
  residentEmail?: string;
  billingMonth: string;
  amount: number;
  dueDate: string;
  status: "DRAFT" | "SENT";
}

export function CreateInvoiceModal({
  open,
  onClose,
  onSubmit,
  isSaving = false,
  serverError = null,
  residents = [],
  residentsLoading = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewInvoicePayload) => void;
  isSaving?: boolean;
  serverError?: string | null;
  /** Hostel residents for the dropdown — "Name — gmail". */
  residents?: Resident[];
  residentsLoading?: boolean;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [residentId, setResidentId] = useState("");

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setResidentId("");
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!residentId) {
      setFormError("Pick a resident from your hostel list.");
      return;
    }
    const picked = residents.find((r) => r.id === residentId);
    if (!picked) {
      setFormError("Pick a resident from your hostel list.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const billingMonth = String(form.get("billingMonth") ?? "");
    const amount = Number(form.get("amount") ?? 0);
    const dueDate = String(form.get("dueDate") ?? "");
    if (!billingMonth || !Number.isFinite(amount) || amount <= 0 || !dueDate) {
      setFormError("Billing month, a positive amount, and a due date are required.");
      return;
    }
    onSubmit({
      hostelId: getHostelId(),
      residentId: picked.id,
      residentName: picked.name,
      residentEmail: picked.email || undefined,
      billingMonth,
      amount,
      dueDate,
      status: String(form.get("status") ?? "DRAFT") as NewInvoicePayload["status"],
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create invoice"
      description="Pick a hostel resident, then add the billing details."
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div>
          <label htmlFor="invoice-resident" className={labelClass}>
            Resident <span className="text-red-600">*</span>
          </label>
          <select
            id="invoice-resident"
            value={residentId}
            onChange={(e) => setResidentId(e.target.value)}
            required
            disabled={isSaving || residentsLoading || residents.length === 0}
            className={fieldClass}
          >
            <option value="">
              {residentsLoading
                ? "Loading hostel residents…"
                : residents.length === 0
                  ? "No residents in this hostel yet"
                  : "Select resident — name · gmail"}
            </option>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.email || "no email"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            Only residents of the related hostel, shown as name + Gmail address.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="invoice-billing-month" className={labelClass}>
              Billing month <span className="text-red-600">*</span>
            </label>
            <input
              id="invoice-billing-month"
              name="billingMonth"
              type="month"
              required
              disabled={isSaving}
              className={fieldClass}
            />
          </div>
          <Input
            label="Amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            required
            disabled={isSaving}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="invoice-due-date" className={labelClass}>
              Due date <span className="text-red-600">*</span>
            </label>
            <input
              id="invoice-due-date"
              name="dueDate"
              type="date"
              required
              disabled={isSaving}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="invoice-status" className={labelClass}>
              Status <span className="text-red-600">*</span>
            </label>
            <select
              id="invoice-status"
              name="status"
              defaultValue="DRAFT"
              disabled={isSaving}
              className={fieldClass}
            >
              <option value="DRAFT">Draft</option>
              <option value="SENT">Send now</option>
            </select>
          </div>
        </div>
        {(formError || serverError) && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {formError ?? serverError}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            Create invoice
          </Button>
        </div>
      </form>
    </Modal>
  );
}
