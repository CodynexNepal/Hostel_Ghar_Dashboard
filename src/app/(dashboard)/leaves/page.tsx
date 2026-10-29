"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/hooks/useApi";
import { getHostelId } from "@/lib/axios";
import {
  hostelGhar,
  normalizeOwnerDashboard,
  toPaginated,
  unwrap,
  validHostelId,
} from "@/lib/hostelGhar";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Protected } from "@/components/common/Protected";
import { useAuth } from "@/hooks/useAuth";
import type { Hostel } from "@/types/hostel";

export default function LeavesIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN";

  const {
    data: hostels,
    error,
    isLoading,
    refetch,
  } = useApi(async () => {
    // 1. Admin users see platform-wide hostels
    if (isAdmin) {
      const res = await hostelGhar.hostels.list();
      return toPaginated<Hostel>(res.data).items;
    }

    // 2. Owners ONLY see hostels they own
    const ownedHostelIds = new Set<string>();

    const directId = validHostelId(user?.hostelId) ?? validHostelId(getHostelId());
    if (directId) {
      ownedHostelIds.add(directId);
    }

    // Fetch from owner dashboard
    try {
      const dashRes = await hostelGhar.owner.dashboard();
      const dash = normalizeOwnerDashboard(dashRes.data);
      if (Array.isArray(dash?.hostels)) {
        dash.hostels.forEach((h) => {
          const hid = validHostelId(h.hostelId);
          if (hid) ownedHostelIds.add(hid);
        });
      }
    } catch {
      // ignore
    }

    // Fetch from owner residentFormHostels
    try {
      const formRes = await hostelGhar.owner.residentFormHostels();
      const formItems = toPaginated<{ id: string; name?: string }>(
        unwrap<unknown>(formRes.data)
      ).items;
      formItems.forEach((item) => {
        const hid = validHostelId(item.id);
        if (hid) ownedHostelIds.add(hid);
      });
    } catch {
      // ignore
    }

    if (ownedHostelIds.size > 0) {
      const list: Hostel[] = [];
      for (const hid of ownedHostelIds) {
        try {
          const res = await hostelGhar.hostels.get(hid);
          const detail = unwrap<Hostel>(res.data);
          if (detail && detail.id) {
            list.push(detail);
          }
        } catch {
          list.push({
            id: hid,
            name: "My Hostel",
            city: "Kathmandu",
            address: "",
          } as Hostel);
        }
      }
      return list;
    }

    return [] as Hostel[];
  }, [user?.hostelId, user?.role, isAdmin]);

  // Seamless auto-redirect for single hostel owners
  useEffect(() => {
    if (!isLoading && hostels && hostels.length === 1 && !isAdmin) {
      router.replace(`/leaves/hostels/${hostels[0].id}`);
    }
  }, [hostels, isLoading, isAdmin, router]);

  // If redirecting single hostel owner, show clean skeleton loading state
  if (!isLoading && hostels && hostels.length === 1 && !isAdmin) {
    return (
      <DashboardShell
        title="Leave Requests"
        subtitle={`Opening leave requests for ${hostels[0].name}...`}
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
          <Card className="space-y-4 overflow-hidden p-5">
            <Skeleton className="h-5 w-48" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-neutral-100 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Leave Requests" subtitle="Hostel-level leave management">
      <Protected permission="VIEW_RESIDENTS">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            {isAdmin
              ? "Select a hostel to manage leave requests and holiday approvals."
              : "Select one of your hostels to manage leave requests."}
          </p>
          <Link href="/leaves/types">
            <Button variant="outline">Manage Leave Types</Button>
          </Link>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={isAdmin ? "All Hostel Leave Requests" : "Your Hostels"}
              subtitle={
                isAdmin
                  ? "Select a hostel to view leave requests"
                  : "Choose a hostel to manage resident leave applications"
              }
            />
            <div className="p-5">
              {isLoading && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/60 bg-white p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-24 rounded-md" />
                    </div>
                  ))}
                </div>
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
                  description="Hostels you own or manage will appear here."
                />
              )}
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(hostels ?? []).map((h) => (
                  <li key={h.id}>
                    <div className="hover:shadow-xs flex items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 transition-all hover:border-neutral-300">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                          <Building2 size={18} />
                        </span>
                        <div>
                          <div className="font-semibold text-neutral-900">{h.name}</div>
                          <div className="text-xs text-neutral-500">
                            {h.city || "Kathmandu"} • {h.address || "Nepal"}
                          </div>
                        </div>
                      </div>
                      <Link href={`/leaves/hostels/${h.id}`}>
                        <Button variant="outline" size="sm" className="text-xs font-semibold">
                          View Requests <ArrowRight size={12} className="ml-1" />
                        </Button>
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
