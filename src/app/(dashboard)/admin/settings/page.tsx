"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { PlatformQrUploadForm } from "@/components/admin/PlatformQrUploadForm";
import Link from "next/link";

/**
 * Super-admin → Platform QRs.
 * Upload the official Hostel Ghar eSewa / Khalti / Bank QRs that hostel
 * owners scan on `/subscription` (Step 1) when paying for a plan.
 */
export default function AdminSettingsPage() {
  return (
    <DashboardShell
      title="Platform QRs"
      subtitle="Upload the official Hostel Ghar payment QRs owners scan during subscription checkout."
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
          <PlatformQrUploadForm />
        </div>
      </Protected>
    </DashboardShell>
  );
}
