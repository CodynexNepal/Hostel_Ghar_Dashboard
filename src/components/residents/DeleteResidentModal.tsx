"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { toApiError } from "@/lib/axios";
import { hostelGhar } from "@/lib/hostelGhar";
import { initials, formatCurrency } from "@/lib/utils";
import type { Resident } from "@/types/resident";
import { AlertTriangle } from "lucide-react";

interface DeleteResidentModalProps {
  open: boolean;
  onClose: () => void;
  resident: Resident | null;
  onSuccess: () => void;
}

export function DeleteResidentModal({
  open,
  onClose,
  resident,
  onSuccess,
}: DeleteResidentModalProps) {
  const { success, error: toastError } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open || !resident) return null;

  async function handleDelete() {
    if (!resident) return;
    setDeleting(true);
    setErrorMessage(null);

    try {
      await hostelGhar.owner.deleteResident(resident.id);
      success("Resident removed", `${resident.name} has been removed.`);
      onSuccess();
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      const msg = apiErr.message || "Failed to remove resident. Please try again.";
      setErrorMessage(msg);
      toastError("Removal failed", msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remove Resident"
      description="Are you sure you want to remove this resident?"
      size="sm"
    >
      <div className="space-y-4 pt-1">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {/* Resident Summary Card */}
        <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-neutral-50 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-neutral-800">
            {initials(resident.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-neutral-900">{resident.name}</h3>
            <p className="truncate text-xs text-neutral-500">
              Room {resident.roomNumber} · Bed {resident.bedNumber} ·{" "}
              {formatCurrency(resident.monthlyRent)}
            </p>
          </div>
          <Badge tone={statusTone(resident.paymentStatus)}>{resident.paymentStatus}</Badge>
        </div>

        {/* Warning text */}
        <div className="flex items-start gap-2.5 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            This action will remove <strong>{resident.name}</strong> from your hostel record and
            free up <strong>Bed {resident.bedNumber}</strong> in{" "}
            <strong>Room {resident.roomNumber}</strong>.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            Yes, Remove
          </Button>
        </div>
      </div>
    </Modal>
  );
}
