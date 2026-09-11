"use client";
import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ImportResidentsPage() {
  return (
    <DashboardShell title="Import Residents" subtitle="Hostel Ghar / Residents / Import">
      <Protected permission="IMPORT_RESIDENTS" redirectTo="/residents">
        <BackLink href="/residents" label="All residents" />
        <div className="mt-3 space-y-4">
          <Card className="border-dashed p-8 text-center">
            <UploadCloud className="mx-auto h-8 w-8 text-neutral-400" aria-hidden />
            <p className="mt-3 font-semibold text-neutral-900">Drop your CSV here</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              Columns: name, email, phone, room, bed, rent. We validate every row before import.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button>Choose file</Button>
              <Button variant="outline">Download template</Button>
            </div>
          </Card>
          <EmptyState
            title="No imports yet"
            description="Your import history will appear here."
            action={
              <Link href="/subscription">
                <Button variant="dark">View plan limits</Button>
              </Link>
            }
          />
        </div>
      </Protected>
    </DashboardShell>
  );
}
