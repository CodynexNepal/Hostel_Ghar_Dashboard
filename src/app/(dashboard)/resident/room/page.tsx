"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";

const ROWS: [string, string][] = [
  ["Room", "201 · Floor 2 · Double sharing"],
  ["Bed", "B1 · Lower bunk"],
  ["Roommates", "Bibek Thapa (B2)"],
  ["Rent", "Rs. 12,000 / month"],
  ["Warden", "Hari Bahadur · 9841000011"],
];

export default function ResidentRoomPage() {
  const { success } = useToast();
  return (
    <DashboardShell title="My Room" subtitle="Hostel Ghar / Resident / Room">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Room 201"
            subtitle="Floor 2 · Double · Attached bath"
            action={<Badge tone="green">OCCUPIED</Badge>}
          />
          <dl className="divide-y divide-neutral-100 px-5">
            {ROWS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right font-medium text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Requests" subtitle="Maintenance and room changes" />
          <div className="space-y-2 p-5">
            {[
              ["Fix leaking tap", "In progress"],
              ["Change bed to upper bunk", "Pending"],
            ].map(([t, s]) => (
              <div
                key={t}
                className="flex items-center justify-between rounded-lg border border-surface-border p-3 text-sm"
              >
                <span className="font-medium">{t}</span>
                <Badge tone={s === "Pending" ? "amber" : "blue"}>{s}</Badge>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => success("Request sent", "Warden will review shortly.")}
            >
              New request
            </Button>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
