"use client";
import { useMemo, useState } from "react";
import { Clock3, LogIn, LogOut, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId } from "@/lib/axios";
import { hostelGhar, toPaginated } from "@/lib/hostelGhar";
import type { HostelDetail } from "@/lib/api-types";
import { useHostelAttendance } from "@/lib/useAttendance";
import { dayKeyLocal, type AttendanceRecord } from "@/lib/attendance-types";
import { initials } from "@/lib/utils";

async function resolveHostelId(preferred?: string | null): Promise<string | null> {
  if (preferred) return preferred;
  const fromCookie = getHostelId();
  if (fromCookie) return fromCookie;
  try {
    const list = await hostelGhar.hostels.list({ limit: 1 });
    return toPaginated<HostelDetail>(list.data).items[0]?.id ?? null;
  } catch {
    return null;
  }
}

export default function OwnerAttendancePage() {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState(dayKeyLocal());
  const [showAll, setShowAll] = useState(false);

  const {
    data: hostelId,
    error: hostelError,
    isLoading: hostelLoading,
    retry,
  } = useApi(() => resolveHostelId(user?.hostelId), [user?.hostelId]);

  const { records, isLoading } = useHostelAttendance(hostelId);

  const filtered = useMemo(() => {
    if (showAll) return records;
    return records.filter((r) => r.date === dateFilter);
  }, [records, dateFilter, showAll]);

  const todayCount = records.filter((r) => r.date === dayKeyLocal()).length;
  const insideNow = records.filter((r) => r.date === dayKeyLocal() && !r.checkOutAt).length;

  return (
    <DashboardShell
      title="Check-In Activity"
      subtitle="Hostel Ghar / Residents — daily attendance history."
    >
      <Protected permission="VIEW_RESIDENTS">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
              <Users className="h-4 w-4" /> Checked in today
            </p>
            <p className="mt-1.5 text-xl font-bold">{todayCount}</p>
          </Card>
          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
              <Clock3 className="h-4 w-4" /> Inside now
            </p>
            <p className="mt-1.5 text-xl font-bold">{insideNow}</p>
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-medium text-neutral-500">Total records</p>
            <p className="mt-1.5 text-xl font-bold">{records.length}</p>
          </Card>
        </div>
        <Card className="mt-4">
          <CardHeader title="Activity" subtitle="One unique record per resident per day" />
          <div className="flex flex-col gap-2 border-b border-surface-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Filter by date"
                value={dateFilter}
                max={dayKeyLocal()}
                onChange={(e) => {
                  setDateFilter(e.target.value || dayKeyLocal());
                  setShowAll(false);
                }}
                className="h-9 rounded-md border border-surface-border px-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="h-9 rounded-md border border-surface-border px-3 text-sm font-medium"
              >
                {showAll ? "Today only" : "All history"}
              </button>
            </div>
            <p className="text-xs text-neutral-500">{filtered.length} records</p>
          </div>
          {hostelLoading || isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : hostelError || !hostelId ? (
            <div className="p-5">
              <p className="text-sm text-red-600">{hostelError?.message ?? "No hostel."}</p>
              <button type="button" onClick={retry} className="mt-2 text-sm underline">
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-5 text-sm text-neutral-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {[...filtered]
                .sort((a, b) => b.checkInAt.localeCompare(a.checkInAt))
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-bold">
                      {initials(r.residentName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{r.residentName}</span>
                      <span className="block text-xs text-neutral-500">
                        In {r.checkInAt.slice(11, 16)}
                        {r.checkOutAt ? ` · Out ${r.checkOutAt.slice(11, 16)}` : " · Inside"}
                      </span>
                    </span>
                    <Badge tone={r.checkOutAt ? "green" : "amber"}>
                      {r.checkOutAt ? "Done" : "Inside"}
                    </Badge>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </Protected>
    </DashboardShell>
  );
}
