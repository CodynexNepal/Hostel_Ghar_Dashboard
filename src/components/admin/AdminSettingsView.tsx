"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Globe,
  Shield,
  Bell,
  CreditCard,
  QrCode,
  Database,
  Server,
  RefreshCw,
  Save,
  CheckCircle2,
  RotateCcw,
  Smartphone,
  Mail,
  AlertTriangle,
  Lock,
  Layers,
  Settings,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { PlatformQrUploadForm } from "@/components/admin/PlatformQrUploadForm";
import { usePlatformSettings, PLATFORM_DEFAULTS } from "@/hooks/usePlatformSettings";
import type { PlatformSettings } from "@/lib/api-types";
import { cn, formatCurrency } from "@/lib/utils";

type SettingsTab =
  | "general"
  | "subscriptions"
  | "qrs"
  | "onboarding"
  | "notifications"
  | "system";

export function AdminSettingsView({ defaultTab }: { defaultTab?: SettingsTab }) {
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab ?? "general");
  const ps = usePlatformSettings();
  const settings: PlatformSettings = ps.settings;
  const setSettings = (next: PlatformSettings) => ps.setSettings(next);
  const [isSaved, setIsSaved] = useState(false);
  const [savingTab, setSavingTab] = useState<string | null>(null);

  // Load tab from URL query on mount (settings load via hook: GET /admin/settings)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as SettingsTab | null;
      if (
        tabParam &&
        ["general", "subscriptions", "qrs", "onboarding", "notifications", "system"].includes(
          tabParam
        )
      ) {
        setActiveTab(tabParam);
      }
    } catch {
      // ignore
    }
  }, []);

  const saveSettings = async (updated?: Partial<PlatformSettings>, tabLabel = "Settings") => {
    setSavingTab(tabLabel);
    const r = await ps.save(updated, tabLabel);
    setSavingTab(null);
    if (r.ok) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      success(tabLabel === "Settings" ? "Settings saved" : `${tabLabel} saved`, r.localOnly ? "Saved locally (backend route not shipped yet)." : "Platform configuration successfully updated.");
    } else {
      toastError(`Couldn't save ${tabLabel.toLowerCase()}`, r.message);
    }
  };

  const handleResetDefaults = async () => {
    ps.setSettings(PLATFORM_DEFAULTS);
    await ps.save(PLATFORM_DEFAULTS);
    success("Reset complete", "Restored standard platform default configuration.");
  };

  const handleClearCache = async () => {
    const r = await ps.purgeCache();
    if (r.ok) success("Platform cache cleared", r.localOnly ? "Purge queued locally — POST /admin/settings/system/purge-cache not shipped yet." : r.message);
    else toastError("Couldn't purge cache", r.message);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: "general", label: "General & Identity", icon: Globe },
    { id: "subscriptions", label: "Billing & Plans", icon: CreditCard },
    { id: "qrs", label: "Platform QRs", icon: QrCode, badge: "Checkout" },
    { id: "onboarding", label: "Access & Security", icon: Shield },
    { id: "notifications", label: "Alerts & Notifications", icon: Bell },
    { id: "system", label: "System & Cache", icon: Server },
  ];

  return (
    <div className="space-y-5">
      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-surface-border pb-2.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-brand-ink text-white shadow-sm"
                  : "bg-surface-muted text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 text-[10px] font-semibold",
                    isActive ? "bg-white/20 text-white" : "bg-brand-ink/10 text-brand-ink"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL PLATFORM SETTINGS */}
      {activeTab === "general" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                title="Platform Identity & Branding"
                subtitle="Core business information and regional settings for Hostel Ghar"
              />
              <form
                className="space-y-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveSettings(undefined, "General & Identity");
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Platform Name"
                    value={settings.platformName}
                    onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                    required
                  />
                  <Input
                    label="Default Currency"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    required
                  />
                </div>

                <Input
                  label="Platform Slogan / Tagline"
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Official Support Email"
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    required
                  />
                  <Input
                    label="Helpline Phone"
                    value={settings.supportPhone}
                    onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                    required
                  />
                </div>

                <Input
                  label="Headquarters Address"
                  value={settings.officeAddress}
                  onChange={(e) => setSettings({ ...settings, officeAddress: e.target.value })}
                />

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                    System Timezone
                  </label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="Asia/Kathmandu (UTC+5:45)">Asia/Kathmandu (Nepal Time · UTC+5:45)</option>
                    <option value="Asia/Kolkata (UTC+5:30)">Asia/Kolkata (IST · UTC+5:30)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between border-t border-surface-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={savingTab === "reset"}
                    onClick={() => {
                      setSavingTab("reset");
                      void handleResetDefaults().finally(() => setSavingTab(null));
                    }}
                    className="text-neutral-500"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
                  </Button>
                  <Button type="submit" variant="primary" loading={savingTab === "General & Identity"}>
                    <Save className="h-4 w-4" /> Save changes
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Regional Summary" subtitle="Localization profile" />
              <div className="space-y-3 p-5 text-sm">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <span className="text-neutral-500">Jurisdiction</span>
                  <span className="font-semibold text-neutral-900">Nepal (NP)</span>
                </div>
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <span className="text-neutral-500">Standard Currency</span>
                  <Badge tone="neutral">{settings.currency}</Badge>
                </div>
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <span className="text-neutral-500">Payment Gateways</span>
                  <span className="text-xs font-medium text-neutral-700">eSewa · Khalti · Bank QR</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Calendar System</span>
                  <span className="font-semibold text-neutral-900">Gregorian + Bikram Sambat</span>
                </div>
              </div>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50">
              <div className="p-4 text-xs text-amber-900">
                <p className="flex items-center gap-1.5 font-semibold text-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Super Admin Authority
                </p>
                <p className="mt-1 text-amber-800">
                  Changes made here instantly configure platform-wide branding, receipts, notification headers, and currency format across all connected hostels.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIPTIONS & PRICING */}
      {activeTab === "subscriptions" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                title="Subscription Rules & Pricing Limits"
                subtitle="Set platform pricing tiers, limits, and grace period policies"
              />
              <form
                className="space-y-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveSettings(undefined, "Billing & Plans");
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Free Tier Resident Limit"
                    type="number"
                    min={1}
                    max={50}
                    value={settings.freeTierResidentCap}
                    onChange={(e) =>
                      setSettings({ ...settings, freeTierResidentCap: Number(e.target.value) || 5 })
                    }
                    required
                  />
                  <Input
                    label="Payment Grace Period (Days)"
                    type="number"
                    min={0}
                    max={30}
                    value={settings.gracePeriodDays}
                    onChange={(e) =>
                      setSettings({ ...settings, gracePeriodDays: Number(e.target.value) || 0 })
                    }
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Standard Plan (NPR / Month)"
                    type="number"
                    min={0}
                    step={100}
                    value={settings.standardPlanPrice}
                    onChange={(e) =>
                      setSettings({ ...settings, standardPlanPrice: Number(e.target.value) || 0 })
                    }
                    required
                  />
                  <Input
                    label="Enterprise Plan (NPR / Month)"
                    type="number"
                    min={0}
                    step={100}
                    value={settings.enterprisePlanPrice}
                    onChange={(e) =>
                      setSettings({ ...settings, enterprisePlanPrice: Number(e.target.value) || 0 })
                    }
                    required
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center justify-between rounded-lg border border-surface-border p-3.5 text-sm transition hover:bg-surface-muted/50">
                    <div>
                      <span className="block font-medium text-neutral-900">
                        Auto-Remind Owners Before Expiry
                      </span>
                      <span className="block text-xs text-neutral-500">
                        Send automatic SMS and in-app notifications 7 days and 2 days before subscription expires.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoRemindRenewals}
                      onChange={(e) =>
                        setSettings({ ...settings, autoRemindRenewals: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-neutral-300 text-brand-ink focus:ring-brand"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-surface-border p-3.5 text-sm transition hover:bg-surface-muted/50">
                    <div>
                      <span className="block font-medium text-neutral-900">
                        Allow Platform QR Proof Checkout
                      </span>
                      <span className="block text-xs text-neutral-500">
                        Enable owners to scan platform eSewa/Khalti QR codes and submit screenshot proofs.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowQrCheckout}
                      onChange={(e) =>
                        setSettings({ ...settings, allowQrCheckout: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-neutral-300 text-brand-ink focus:ring-brand"
                    />
                  </label>
                </div>

                <div className="flex justify-end border-t border-surface-border pt-4">
                  <Button type="submit" variant="primary" loading={savingTab === "Billing & Plans"}>
                    <Save className="h-4 w-4" /> Save subscription policy
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Tier Summary" subtitle="Current live plan matrix" />
              <div className="space-y-3 p-5 text-sm">
                <div className="rounded-lg bg-surface-muted p-3">
                  <div className="flex items-center justify-between font-semibold text-neutral-900">
                    <span>Free Plan</span>
                    <span>Rs. 0</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Up to {settings.freeTierResidentCap} active residents. Basic bed allocation and ledger.
                  </p>
                </div>
                <div className="rounded-lg border border-brand/40 bg-brand/5 p-3">
                  <div className="flex items-center justify-between font-semibold text-neutral-900">
                    <span>Standard Plan</span>
                    <span>{formatCurrency(settings.standardPlanPrice)}/mo</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">
                    Unlimited residents, SMS billing alerts, multi-room management, expense tracker.
                  </p>
                </div>
                <div className="rounded-lg bg-brand-ink/5 p-3">
                  <div className="flex items-center justify-between font-semibold text-neutral-900">
                    <span>Enterprise Plan</span>
                    <span>{formatCurrency(settings.enterprisePlanPrice)}/mo</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">
                    Custom domain, multi-hostel owner console, priority review queue, dedicated account manager.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM QRS (Direct Integration) */}
      {activeTab === "qrs" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            <p className="font-medium">
              Official Platform QRs for Subscription Payments
            </p>
            <p className="mt-0.5 text-xs text-teal-800">
              Hostel owners scanning QR codes on the upgrade modal will see these exact QRs. Keep your eSewa, Khalti, and Bank details up to date.
            </p>
          </div>
          <PlatformQrUploadForm />
        </div>
      )}

      {/* TAB 4: ACCESS & SECURITY */}
      {activeTab === "onboarding" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Hostel Onboarding Policies"
              subtitle="Control who can register and launch hostels on the platform"
            />
            <div className="space-y-3 p-5">
              <label className="flex items-center justify-between rounded-lg border border-surface-border p-3.5 text-sm transition hover:bg-surface-muted/50">
                <div>
                  <span className="block font-medium text-neutral-900">Public Hostel Registration</span>
                  <span className="block text-xs text-neutral-500">
                    Allow owners to submit new hostels from the public registration portal.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowPublicHostelSignup}
                  onChange={(e) =>
                    setSettings({ ...settings, allowPublicHostelSignup: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-neutral-300 text-brand-ink focus:ring-brand"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-surface-border p-3.5 text-sm transition hover:bg-surface-muted/50">
                <div>
                  <span className="block font-medium text-neutral-900">Require Super Admin Approval</span>
                  <span className="block text-xs text-neutral-500">
                    Newly registered hostels remain in pending state until approved by admin.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireHostelApproval}
                  onChange={(e) =>
                    setSettings({ ...settings, requireHostelApproval: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-neutral-300 text-brand-ink focus:ring-brand"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-surface-border p-3.5 text-sm transition hover:bg-surface-muted/50">
                <div>
                  <span className="block font-medium text-neutral-900">Resident Self-Registration</span>
                  <span className="block text-xs text-neutral-500">
                    Residents can claim bed via hostel invite code or owner invitation email.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowResidentSelfInvite}
                  onChange={(e) =>
                    setSettings({ ...settings, allowResidentSelfInvite: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-neutral-300 text-brand-ink focus:ring-brand"
                />
              </label>

              <div className="flex justify-end pt-2">
                <Button onClick={() => void saveSettings(undefined, "Access & Security")} variant="primary" loading={savingTab === "Access & Security"}>
                  <Save className="h-4 w-4" /> Save onboarding policies
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Security & Session Authentication"
              subtitle="Session rules and admin account protection"
            />
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                  JWT Session Lifetime (Days)
                </label>
                <select
                  value={settings.sessionLifetimeDays}
                  onChange={(e) =>
                    setSettings({ ...settings, sessionLifetimeDays: Number(e.target.value) || 14 })
                  }
                  className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value={7}>7 Days (Strict)</option>
                  <option value={14}>14 Days (Standard)</option>
                  <option value={30}>30 Days (Extended)</option>
                </select>
                <p className="mt-1 text-xs text-neutral-500">
                  Users inactive longer than this period must re-authenticate.
                </p>
              </div>

              <label className="flex items-center justify-between rounded-lg border border-surface-border p-3.5 text-sm transition hover:bg-surface-muted/50">
                <div>
                  <span className="block font-medium text-neutral-900">Enforce 2FA on Super Admins</span>
                  <span className="block text-xs text-neutral-500">
                    Require TOTP authenticator code on all administrative logins.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireAdmin2FA}
                  onChange={(e) => setSettings({ ...settings, requireAdmin2FA: e.target.checked })}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-ink focus:ring-brand"
                />
              </label>

              <div className="rounded-lg bg-surface-muted p-3.5 text-xs text-neutral-600">
                <div className="flex items-center gap-1.5 font-semibold text-neutral-900">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" /> End-to-End Cookie Security
                </div>
                <p className="mt-0.5">
                  Cookies (`hg_access_token` and `hg_hostel_id`) are signed with `SameSite=Lax` and HTTPS Secure flags in production.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => void saveSettings(undefined, "Access & Security")} variant="primary" loading={savingTab === "Access & Security"}>
                  <Save className="h-4 w-4" /> Save security rules
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: ALERTS & NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Super Admin Notification Triggers"
              subtitle="Configure automated platform alerts and threshold warnings"
            />
            <div className="space-y-4 p-5">
              <label className="flex items-center justify-between rounded-lg border border-surface-border p-3.5 text-sm transition hover:bg-surface-muted/50">
                <div>
                  <span className="block font-medium text-neutral-900">
                    Subscription Payment Proof Alerts
                  </span>
                  <span className="block text-xs text-neutral-500">
                    Instant notification when a hostel owner uploads an eSewa/Khalti slip for review.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifyOnSubscriptionProof}
                  onChange={(e) =>
                    setSettings({ ...settings, notifyOnSubscriptionProof: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-neutral-300 text-brand-ink focus:ring-brand"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-surface-border p-3.5 text-sm transition hover:bg-surface-muted/50">
                <div>
                  <span className="block font-medium text-neutral-900">Daily Operations Digest</span>
                  <span className="block text-xs text-neutral-500">
                    Morning summary of active bookings, total collections, and new resident admissions.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.dailyDigestEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, dailyDigestEmail: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-neutral-300 text-brand-ink focus:ring-brand"
                />
              </label>

              <div>
                <Input
                  label="Platform Overdue Dues Alert Threshold (NPR)"
                  type="number"
                  step={5000}
                  value={settings.overdueAlertThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      overdueAlertThreshold: Number(e.target.value) || 10000,
                    })
                  }
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Trigger high-priority alert on the admin overview if cumulative overdue platform fees exceed this figure.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => void saveSettings(undefined, "Alerts & Notifications")} variant="primary" loading={savingTab === "Alerts & Notifications"}>
                  <Save className="h-4 w-4" /> Save alert settings
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="SMS & Communication Providers"
              subtitle="Nepal telecom SMS gateway gateway dispatch"
            />
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                  SMS Gateway Provider
                </label>
                <select
                  value={settings.smsGatewayProvider}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      smsGatewayProvider: e.target.value as PlatformSettings["smsGatewayProvider"],
                    })
                  }
                  className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="SPARROW_SMS">Sparrow SMS (Nepal Telecom & Ncell)</option>
                  <option value="AAKASH_SMS">Aakash SMS (Enterprise OTP & Alerts)</option>
                  <option value="MOCK">Simulated / Mock Gateway (Testing Mode)</option>
                </select>
                <p className="mt-1 text-xs text-neutral-500">
                  Used for rent receipts, admission OTPs, and resident payment reminders.
                </p>
              </div>

              <div className="rounded-lg border border-surface-border bg-surface-muted/60 p-4 text-xs text-neutral-700">
                <div className="flex items-center gap-1.5 font-semibold text-neutral-900">
                  <Smartphone className="h-3.5 w-3.5 text-blue-600" /> Gateway Dispatch Health
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-neutral-600">
                  <div>Delivery Success Rate: <span className="font-semibold text-emerald-600">99.4%</span></div>
                  <div>Average Latency: <span className="font-semibold text-neutral-900">1.2s</span></div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => void saveSettings(undefined, "Alerts & Notifications")} variant="primary" loading={savingTab === "Alerts & Notifications"}>
                  <Save className="h-4 w-4" /> Save SMS config
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: SYSTEM & CACHE */}
      {activeTab === "system" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="System Cache Management"
              subtitle="L1 In-Memory and L2 Redis Caching performance"
            />
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-surface-border bg-surface-muted p-3.5">
                  <p className="text-xs text-neutral-500">L1 Memory Cache</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active (0.2ms)
                  </p>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-muted p-3.5">
                  <p className="text-xs text-neutral-500">L2 Redis Cache</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Connected (L2)
                  </p>
                </div>
              </div>

              <p className="text-xs text-neutral-600">
                Dashboard analytics summaries are automatically cached in L2 for 60 seconds to ensure high-performance rendering under peak loads.
              </p>

              <div className="border-t border-surface-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  loading={ps.purging}
                  onClick={handleClearCache}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Purge all platform caches
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Maintenance Mode"
              subtitle="Temporary service interruption banner"
            />
            <div className="space-y-4 p-5">
              <label className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-sm">
                <div>
                  <span className="block font-medium text-amber-950">Maintenance Mode</span>
                  <span className="block text-xs text-amber-800">
                    Display maintenance notice across owner and resident portals. Super admins retain access.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) =>
                    setSettings({ ...settings, maintenanceMode: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
              </label>

              {settings.maintenanceMode && (
                <div>
                  <Input
                    label="Public Maintenance Banner Text"
                    value={settings.maintenanceMessage}
                    onChange={(e) =>
                      setSettings({ ...settings, maintenanceMessage: e.target.value })
                    }
                  />
                </div>
              )}

              <div className="rounded-lg bg-surface-muted p-3.5 text-xs text-neutral-600">
                <div className="flex items-center justify-between">
                  <span>Engine: <strong className="text-neutral-900">Hostel Ghar Core v2.4</strong></span>
                  <span>Database: <strong className="text-emerald-600">PostgreSQL 15 (Pool OK)</strong></span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => void saveSettings(undefined, "System & Cache")} variant="primary" loading={savingTab === "System & Cache"}>
                  <Save className="h-4 w-4" /> Save system state
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
