"use client";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/hooks/useApi";
import { hostelGhar, toPaginated } from "@/lib/hostelGhar";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Protected } from "@/components/common/Protected";
import { useAuth } from "@/hooks/useAuth";
import type { Hostel } from "@/types/hostel";

export default function LeavesIndexPage() {
  const { user } = useAuth();
  const {
    data: hostels,
    error,
    isLoading,
    refetch,
  } = useApi(async () => {
    // Owner sees own hostel first; admin sees platform list.
    if (user?.hostelId) {
      const single = await hostelGhar.hostels.get(user.hostelId);
      const one = (single.data as { data?: Hostel }) ?? null;
      const item =
        (one as unknown as { data?: Hostel })?.data ?? (single.data as unknown as Hostel);
      return [item].filter(Boolean) as Hostel[];
    }
    const res = await hostelGhar.hostels.list();
    return toPaginated<Hostel>(res.data).items;
  }, [user?.hostelId]);

  return (
    <DashboardShell title="Leave Requests" subtitle="Hostel-level leave management">
      <Protected permission="VIEW_RESIDENTS">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Hostel Leave Requests"
              subtitle="Select a hostel to view leave requests"
            />
            <div className="p-5">
              {isLoading && (
                <p role="status" className="text-sm text-neutral-500">
                  Loading hostels…
                </p>
              )}
              {!isLoading && error && (
                <ErrorState
                  title="Couldn't load hostels"
                  description={error.message}
                  onRetry={refetch}
                />
              )}
              {!isLoading && !error && (!hostels || hostels.length === 0) && (
                <EmptyState
                  title="No hostels found"
                  description="Hostels you manage will appear here."
                />
              )}
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(hostels ?? []).map((h) => (
                  <li key={h.id} className="">
                    <div className="flex items-center justify-between gap-3 rounded-md border p-4">
                      <div>
                        <div className="font-medium">{h.name}</div>
                        <div className="text-sm text-neutral-500">
                          {h.city} • {h.address}
                        </div>
                      </div>
                      <Link href={`/leaves/hostels/${h.id}`}>
                        <Button variant="outline">View Requests</Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </Protected>
    </DashboardShell>
  );
}
