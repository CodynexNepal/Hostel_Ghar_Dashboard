"use client";
import { Modal } from "@/components/ui/Modal";
import type { ResidentImport, ResidentImportPlanLimits } from "@/lib/api-types";

export function LimitsModal({
  open,
  loading,
  limits,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  limits: ResidentImportPlanLimits | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Plan limits — bulk import"
      description="Checked before each import is queued."
    >
      {loading ? (
        <p className="text-sm text-neutral-500">Loading limits…</p>
      ) : limits ? (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Max rows / file</dt>
            <dd className="font-semibold text-neutral-900">{limits.maxRowsPerFile}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Max file size</dt>
            <dd className="font-semibold text-neutral-900">
              {(limits.maxFileBytes / 1024 / 1024).toFixed(0)}MB
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Concurrent imports</dt>
            <dd className="font-semibold text-neutral-900">{limits.maxConcurrentImports}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Monthly row budget</dt>
            <dd className="font-semibold text-neutral-900">{limits.monthlyRowBudget}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Columns</dt>
            <dd className="text-right font-mono text-xs text-neutral-900">
              {limits.columns.join(", ")}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-neutral-500">Limits unavailable.</p>
      )}
    </Modal>
  );
}

export function DetailModal({
  detail,
  loading,
  onClose,
}: {
  detail: ResidentImport | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={detail !== null || loading}
      onClose={onClose}
      title={detail ? `Import — ${detail.fileName}` : "Import detail"}
      description={detail ? `${detail.status} · row-level errors` : "Loading…"}
    >
      {loading && !detail ? (
        <p className="text-sm text-neutral-500">Loading import…</p>
      ) : detail ? (
        <div className="space-y-3">
          {detail.failureReason && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {detail.failureReason}
            </p>
          )}
          {(detail.rowErrors ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No row errors — every row imported.</p>
          ) : (
            <ul className="max-h-64 space-y-1.5 overflow-auto text-[13px]">
              {(detail.rowErrors ?? []).map((rowErr, idx) => (
                <li key={`${rowErr.row}-${idx}`} className="rounded-md bg-neutral-100 px-3 py-2">
                  <span className="font-semibold text-neutral-900">Row {rowErr.row}</span>
                  {rowErr.email && <span className="text-neutral-500"> · {rowErr.email}</span>}
                  <span className="block text-neutral-700">{rowErr.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
