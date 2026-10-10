"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { AdminSettingsView } from "@/components/admin/AdminSettingsView";
import Link from "next/link";

/**
 * Super-admin → Platform Settings.
 * Central administrative settings for platform branding, regional defaults,
 * subscription plans, official payment QRs, onboarding policies, alerts, and system cache.
 */
export default function AdminSettingsPage() {
  return (
    <DashboardShell
      title="Platform Settings"
      subtitle="Branding, subscription pricing rules, platform payment QRs, security, and cache controls."
    >
      <Protected roles={["SUPER_ADMIN"]} redirectTo="/dashboard">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BackLink href="/admin" label="Back to overview" />
            <Link href="/admin/subscriptions">
              <Button size="sm" variant="outline">
                Review subscription payments
              </Button>
            </Link>
          </div>
          <AdminSettingsView />
        </div>
      </Protected>
    </DashboardShell>
  );
}
