"use client";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RoleSwitcher } from "@/components/common/RoleSwitcher";
import { useApi } from "@/hooks/useApi";
import { hostelGhar, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { AdminSummary } from "@/lib/api-types";
import type { Hostel } from "@/types/hostel";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";

export default function SuperAdminPage() {
  const {
    data: summary,
    error,
    isLoading,
    refetch,
  } = useApi(async () => {
    const res = await hostelGhar.analytics.adminSummary();
    return unwrap<AdminSummary>(res.data);
  }, []);
  const { data: hostels } = useApi(async () => {
    try {
      const res = await hostelGhar.admin.listHostels({ limit: 5 });
      return toPaginated<Hostel>(res.data).items;
    } catch {
      return [] as Hostel[];
    }
  }, []);

  const stats: [string, string, string][] = [
    ["Total Hostels", String(summary?.totalHostels ?? "—"), "platform-wide"],
    ["Total Residents", String(summary?.totalResidents ?? "—"), "all hostels"],
    ["MRR", formatCurrency(Number(summary?.mrr ?? summary?.monthlyRevenue ?? 0)), "recurring"],
    ["Active Plans", String(summary?.activePlans ?? "—"), "paid plans"],
  ];

  return (
    <DashboardShell title="Platform Overview" subtitle="All hostels, owners, revenue and health.">
      <div className="space-y-5">
        <RoleSwitcher />
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="space-y-2 p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Couldn't load platform stats"
            description={error.message}
            onRetry={refetch}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(([t, v, h]) => (
              <Card key={t} className="p-5">
                <p className="text-[13px] text-neutral-500">{t}</p>
                <p className="mt-1 text-2xl font-bold">{v}</p>
                <p className="mt-0.5 text-xs text-neutral-400">{h}</p>
              </Card>
            ))}
          </div>
        )}
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
            {(hostels ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-neutral-500">No hostels synced yet.</p>
            ) : (
              (hostels ?? []).map((h) => (
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
                    <Link href="/admin/hostels">
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </Link>
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
