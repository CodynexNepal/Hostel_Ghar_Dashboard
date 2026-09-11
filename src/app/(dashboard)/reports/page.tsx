"use client";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/useToast";

const REPORTS = [
  ["Occupancy report", "Room-wise bed usage · Sep 2026", "PDF"],
  ["Revenue report", "Collections by month & method", "CSV"],
  ["Defaulter list", "Pending + overdue dues", "PDF"],
  ["Resident directory", "Profiles with room mapping", "CSV"],
];

export default function ReportsPage() {
  const { success } = useToast();
  return (
    <DashboardShell title="Reports" subtitle="Hostel Ghar / Reports — occupancy, revenue and dues.">
      <Protected permission="VIEW_REPORTS" redirectTo="/dashboard">
        <div className="grid gap-4 sm:grid-cols-2">
          {REPORTS.map(([t, d, fmt]) => (
            <Card key={t}>
              <div className="flex items-start gap-3 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand">
                  <FileText className="h-5 w-5 text-brand-ink" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    {t}
                    <Badge tone="gray">{fmt}</Badge>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-neutral-500">{d}</span>
                </span>
              </div>
              <div className="flex gap-2 border-t border-surface-border px-5 py-3">
                <Button
                  size="sm"
                  onClick={() => success("Report queued", `${t} will download shortly.`)}
                >
                  <Download className="h-3.5 w-3.5" /> Generate
                </Button>
                <Button size="sm" variant="outline" onClick={() => success("Preview opened", t)}>
                  Preview
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Protected>
    </DashboardShell>
  );
}
