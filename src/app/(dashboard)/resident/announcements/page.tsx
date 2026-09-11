"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MOCK_ANNOUNCEMENTS } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { MessageSquareWarning } from "lucide-react";

export default function ResidentExtrasPage() {
  const { success } = useToast();
  return (
    <DashboardShell title="Facilities & Announcements" subtitle="What's happening at your hostel.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Announcements" subtitle="Latest from warden" />
          <ul className="divide-y divide-neutral-100">
            {MOCK_ANNOUNCEMENTS.map((a) => (
              <li key={a.id} className="px-5 py-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {a.title}
                  <Badge tone="gray">{a.tag}</Badge>
                </p>
                <p className="mt-0.5 text-[13px] text-neutral-500">{a.body}</p>
                <p className="mt-1 text-xs text-neutral-400">{formatDate(a.date)}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title="Complaints"
            subtitle="We resolve within 48 hours"
            action={<MessageSquareWarning className="h-4 w-4 text-neutral-400" />}
          />
          <div className="space-y-2 p-5">
            <textarea
              aria-label="Describe your complaint"
              placeholder="Describe your issue…"
              rows={4}
              className="w-full rounded-md border border-surface-border bg-white p-3 text-sm outline-none placeholder:text-neutral-400 focus:border-brand-ink"
            />
            <Button
              className="w-full"
              onClick={() => success("Complaint filed", "Ticket #4821 created.")}
            >
              Submit complaint
            </Button>
            <p className="text-center text-xs text-neutral-400">
              Past tickets: tap fixed (resolved) · WiFi slow (resolved)
            </p>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
