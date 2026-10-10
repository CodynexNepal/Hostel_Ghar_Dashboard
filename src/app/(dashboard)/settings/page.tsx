"use client";
import { useState } from "react";
import { Bell, Save, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";

import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerSettings } from "@/hooks/useOwnerSettings";
import { cn } from "@/lib/utils";
import { PaymentQrSettings } from "@/components/payments/PaymentQrSettings";

export default function SettingsPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const s = useOwnerSettings(user?.hostelId);
  const [cur, setCur] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
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
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await s.saveProfile();
                if (r.ok) success("Settings saved", r.message);
                else toastError("Couldn't save profile", r.message);
              }}
            >
              <Input label="Hostel name" value={s.profile.name} disabled={!s.profileLoaded} onChange={(e) => s.setProfile({ ...s.profile, name: e.target.value })} required />
              <Input label="Phone" value={s.profile.phone} disabled={!s.profileLoaded} onChange={(e) => s.setProfile({ ...s.profile, phone: e.target.value })} required />
              <Input label="Email" value={s.profile.email} disabled={!s.profileLoaded} onChange={(e) => s.setProfile({ ...s.profile, email: e.target.value })} required />
              <Input label="Address" value={s.profile.address} disabled={!s.profileLoaded} onChange={(e) => s.setProfile({ ...s.profile, address: e.target.value })} required />
              <div className="flex justify-end">
                <Button type="submit" loading={s.profileSaving} disabled={!s.profileLoaded}>
                  <Save className="h-4 w-4" /> Save changes
                </Button>
              </div>
            </form>
          </Card>
          <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Notifications" subtitle="Payment reminders and alerts" />
            <div className="space-y-3 p-5">
              <button
                onClick={() => s.prefsLoaded && s.setPrefs({ ...s.prefs, rentReminders: !s.prefs.rentReminders })}
                aria-pressed={s.prefs.rentReminders}
                disabled={!s.prefsLoaded}
                className="flex w-full items-center justify-between rounded-lg border border-surface-border p-4 text-left disabled:opacity-60"
              >
                <span className="flex items-center gap-3">
                  <Bell className="h-4 w-4" />
                  <span>
                    <span className="block text-sm font-semibold">Rent reminders</span>
                    <span className="block text-xs text-neutral-500">
                      SMS + email {s.prefs.reminderDaysBefore ?? 3} days before due
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    s.prefs.rentReminders ? "bg-brand-ink" : "bg-neutral-200"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                      s.prefs.rentReminders ? "left-[22px]" : "left-0.5"
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
                loading={s.prefsSaving}
                disabled={!s.prefsLoaded}
                onClick={async () => {
                  const r = await s.savePrefs();
                  if (r.ok) success("Preferences saved", r.message);
                  else toastError("Couldn't save", r.message);
                }}
              >
                Save preferences
              </Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Security" subtitle="Change your login password" />
            <form
              className="space-y-4 p-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setPwErr(null);
                if (nextPw.length < 8) { setPwErr("New password must be at least 8 characters."); return; }
                if (nextPw !== confirm) { setPwErr("New passwords don't match."); return; }
                const r = await s.changePassword(cur, nextPw);
                if (r.ok) { setCur(""); setNextPw(""); setConfirm(""); success("Password changed", r.message); }
                else { setPwErr(r.message); toastError("Couldn't change password", r.message); }
              }}
            >
              <Input label="Current password" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="New password" type="password" autoComplete="new-password" value={nextPw} onChange={(e) => setNextPw(e.target.value)} required />
                <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              {pwErr && <p role="alert" className="text-xs text-red-600">{pwErr}</p>}
              <div className="flex justify-end">
                <Button type="submit" loading={s.changingPw}>
                  <ShieldCheck className="h-4 w-4" /> Change password
                </Button>
              </div>
            </form>
          </Card>
          </div>
        </div>
        <div className="mt-4">
          <PaymentQrSettings />
        </div>
      </Protected>
    </DashboardShell>
  );
}
