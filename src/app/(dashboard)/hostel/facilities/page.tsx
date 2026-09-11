"use client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function FacilitiesPage() {
  return (
    <DashboardShell title="Facilities" subtitle="Hostel Ghar / Hostel / Facilities">
      <Protected permission="VIEW_HOSTEL">
        <Card>
          <CardHeader title="Facilities" subtitle="Shared amenities for residents" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[
              ["Mess & dining", "3 meals + snacks", "Included"],
              ["Laundry", "Twice a week", "Included"],
              ["Study hall", "6 AM – 10 PM", "Included"],
              ["Parking", "Bikes only", "Limited"],
              ["Gym corner", "Basic equipment", "PRO hostels"],
              ["Pickup service", "Airport / buspark", "Add-on"],
            ].map(([t, d, tag]) => (
              <div key={t} className="rounded-lg border border-surface-border p-4">
                <p className="flex items-center justify-between text-sm font-semibold">
                  {t}
                  <Badge tone="gray">{tag}</Badge>
                </p>
                <p className="mt-1 text-[13px] text-neutral-500">{d}</p>
              </div>
            ))}
          </div>
        </Card>
      </Protected>
    </DashboardShell>
  );
}
