"use client";
import { Bell, Save } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PaymentQrSettings } from "@/components/payments/PaymentQrSettings";

export default function SettingsPage() {
  const { success } = useToast();
  const [reminders, setReminders] = useState(true);
  return (
    <DashboardShell
      title="Settings"
      subtitle="Hostel Ghar / Settings — hostel profile and preferences."
    >
      <Protected permission="MANAGE_SETTINGS">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Hostel profile" subtitle="Shown to residents and on invoices" />
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                success("Settings saved", "Hostel profile updated.");
              }}
            >
              <Input label="Hostel name" defaultValue="Sunrise Boys Hostel" />
              <Input label="Phone" defaultValue="01-4445555" />
              <Input label="Email" defaultValue="info@sunrise.com" />
              <Input label="Address" defaultValue="Putalisadak, Kathmandu" />
              <div className="flex justify-end">
                <Button type="submit">
                  <Save className="h-4 w-4" /> Save changes
                </Button>
              </div>
            </form>
          </Card>
          <Card>
            <CardHeader title="Notifications" subtitle="Payment reminders and alerts" />
            <div className="space-y-3 p-5">
              <button
                onClick={() => setReminders((r) => !r)}
                aria-pressed={reminders}
                className="flex w-full items-center justify-between rounded-lg border border-surface-border p-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <Bell className="h-4 w-4" />
                  <span>
                    <span className="block text-sm font-semibold">Rent reminders</span>
                    <span className="block text-xs text-neutral-500">
                      SMS + email 3 days before due
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    reminders ? "bg-brand-ink" : "bg-neutral-200"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                      reminders ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </span>
              </button>
              <div className="rounded-lg bg-surface-muted p-4 text-[13px] text-neutral-600">
                Automated reminders, receipts and late-fee rules unlock on PRO.{" "}
                <span className="font-semibold text-neutral-900">Current: manual.</span>
              </div>
              <Button
                variant="outline"
                onClick={() => success("Preferences saved", "Notification settings updated.")}
              >
                Save preferences
              </Button>
            </div>
          </Card>
        </div>
        <div className="mt-4">
          <PaymentQrSettings />
        </div>
      </Protected>
    </DashboardShell>
  );
}
