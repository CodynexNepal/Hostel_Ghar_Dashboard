"use client";

import type { FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getHostelId } from "@/lib/axios";

const fieldClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand";
const labelClass = "mb-1.5 block text-[13px] font-medium text-neutral-800";

export interface NewInvoicePayload {
  hostelId: string | null;
  residentName: string;
  billingMonth: string;
  amount: number;
  dueDate: string;
  status: "DRAFT" | "SENT";
}

export function CreateInvoiceModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewInvoicePayload) => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      hostelId: getHostelId(),
      residentName: String(form.get("residentName") ?? ""),
      billingMonth: String(form.get("billingMonth") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      dueDate: String(form.get("dueDate") ?? ""),
      status: String(form.get("status") ?? "DRAFT") as NewInvoicePayload["status"],
    });
    event.currentTarget.reset();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create invoice"
      description="Add the billing details for one resident."
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        <Input label="Resident name" name="residentName" placeholder="e.g. Sita Karki" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="invoice-billing-month" className={labelClass}>
              Billing month <span className="text-red-600">*</span>
            </label>
            <input id="invoice-billing-month" name="billingMonth" type="month" required className={fieldClass} />
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
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="invoice-due-date" className={labelClass}>
              Due date <span className="text-red-600">*</span>
            </label>
            <input id="invoice-due-date" name="dueDate" type="date" required className={fieldClass} />
          </div>
          <div>
            <label htmlFor="invoice-status" className={labelClass}>
              Status <span className="text-red-600">*</span>
            </label>
            <select id="invoice-status" name="status" defaultValue="DRAFT" className={fieldClass}>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Send now</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create invoice</Button>
        </div>
      </form>
    </Modal>
  );
}
