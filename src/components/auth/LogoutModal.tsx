"use client";

import { useCallback, useState } from "react";
import { LogOut, MonitorSmartphone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function LogoutModal({
  open,
  userName,
  isLoggingOut,
  error,
  onCancel,
  onConfirm,
  onConfirmAll,
}: {
  open: boolean;
  userName?: string | null;
  isLoggingOut: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmAll: () => void;
}) {
  const [logoutAll, setLogoutAll] = useState(false);

  const handleConfirm = useCallback(() => {
    if (logoutAll) onConfirmAll();
    else onConfirm();
  }, [logoutAll, onConfirm, onConfirmAll]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Log out?"
      description={
        userName
          ? `${userName}, are you sure you want to log out of Hostel Ghar?`
          : "Are you sure you want to log out of Hostel Ghar?"
      }
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface-muted p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
            <LogOut className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            This ends your current session on this device. Any unsaved changes will be lost.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-surface-border p-3 transition-colors hover:border-neutral-300">
          <input
            type="checkbox"
            checked={logoutAll}
            onChange={(e) => setLogoutAll(e.target.checked)}
            disabled={isLoggingOut}
            className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-900"
          />
          <span>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-900">
              <MonitorSmartphone className="h-4 w-4" aria-hidden />
              Log out of all devices
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Also kills every other phone, tablet and browser session instantly.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoggingOut}>
            Stay logged in
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={isLoggingOut}
            className="min-w-[120px]"
          >
            {logoutAll ? "Log out everywhere" : "Yes, log out"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
