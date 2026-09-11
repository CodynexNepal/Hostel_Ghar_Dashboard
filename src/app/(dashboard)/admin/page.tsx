"use client";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RoleSwitcher } from "@/components/common/RoleSwitcher";
import { MOCK_HOSTELS, MOCK_PAYMENTS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

export default function SuperAdminPage() {
  return (
    <DashboardShell title="Platform Overview" subtitle="All hostels, owners, revenue and health.">
      <div className="space-y-5">
        <RoleSwitcher />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total Hostels", "148", "+6 this month"],
            ["Total Residents", "4,280", "+212"],
            ["MRR", formatCurrency(486000), "+9.4%"],
            ["Active Plans", "112 PRO", "76% paid"],
          ].map(([t, v, h]) => (
            <Card key={t} className="p-5">
              <p className="text-[13px] text-neutral-500">{t}</p>
              <p className="mt-1 text-2xl font-bold">{v}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{h}</p>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader
            title="Hostels"
            subtitle="Every hostel on the platform"
            action={
              <Link href="/admin/hostels">
                <Button size="sm">Manage hostels</Button>
              </Link>
            }
          />
          <div className="divide-y divide-neutral-100">
            {MOCK_HOSTELS.map((h) => (
              <div
                key={h.id}
                className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{h.name}</span>
                  <span className="block text-xs text-neutral-500">
                    {h.city} · {h.ownerName} · {h.occupiedBeds}/{h.totalBeds} beds
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={h.status === "ACTIVE" ? "green" : "amber"}>{h.status}</Badge>
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Latest platform payments" subtitle="Across all hostels" />
          <ul className="divide-y divide-neutral-100">
            {MOCK_PAYMENTS.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="truncate font-medium">{p.residentName}</span>
                <span className="font-bold">{formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </DashboardShell>
  );
}
