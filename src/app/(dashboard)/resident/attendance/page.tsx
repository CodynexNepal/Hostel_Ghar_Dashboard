"use client";
import { useMemo, useState } from "react";
import { CalendarCheck2, LogIn, LogOut, Timer } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { SlideToAction } from "@/components/attendance/SlideToAction";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getHostelId } from "@/lib/axios";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";
import { useMyAttendance } from "@/lib/useAttendance";
import { checkIn, checkOut } from "@/lib/attendance-actions";
import {
  dayKeyLocal,
  durationLabel,
  formatTimeOfDay,
  type AttendanceIdentity,
  type AttendanceRecord,
} from "@/lib/attendance-types";
import { formatDate } from "@/lib/utils";

export default function ResidentAttendancePage() {
  const { user } = useAuth();
  const room = useMyRoomSummary();
  const { success, error: toastError } = useToast();
  const [busy, setBusy] = useState(false);

  const identity: AttendanceIdentity | null = useMemo(() => {
    if (!user) return null;
    return {
      residentId: user.id,
      residentName: user.name || "Resident",
      residentEmail: user.email,
      hostelId: room.hostelId || user.hostelId || getHostelId() || null,
      hostelName: room.hostelName || user.hostelName || "Hostel",
      roomNumber: room.myRoom?.roomNumber ? String(room.myRoom.roomNumber) : undefined,
      bedNumber: room.myRoom?.bedNumber ? String(room.myRoom.bedNumber) : undefined,
    };
  }, [user, room.hostelId, room.hostelName, room.myRoom]);

  const { today, history, isLoading, nextAction, refresh } = useMyAttendance(identity);

  async function handleComplete() {
    if (busy) return;
    if (!identity) {
      toastError("Not ready", "Your session is still loading — try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      const isCheckIn = nextAction === "CHECK_IN";
      const res = isCheckIn ? await checkIn(identity) : await checkOut(identity);

      if ("reason" in res && typeof (res as { reason?: unknown }).reason === "string") {
        const errObj = res as { reason: string; message?: unknown };
        const errMsg = typeof errObj.message === "string" ? errObj.message : "";
        if (errObj.reason === "ALREADY_CHECKED_IN" || errObj.reason === "ALREADY_CHECKED_OUT") {
          await refresh();
          success(isCheckIn ? "Already checked in" : "Already checked out", errMsg || undefined);
        } else {
          toastError(
            isCheckIn ? "Could not check in" : "Could not check out",
            errMsg || "Please check your connection and try again."
          );
        }
      } else {
        const record = res as AttendanceRecord;
        const timeStr = isCheckIn
          ? formatTimeOfDay(record.checkInAt)
          : formatTimeOfDay(record.checkOutAt || record.checkInAt);
        success(
          isCheckIn ? "Checked in successfully" : "Checked out successfully",
          isCheckIn ? `Check-in recorded at ${timeStr}.` : `Check-out recorded at ${timeStr}.`
        );
        await refresh();
      }
    } catch (err: unknown) {
      toastError("Action failed", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const doneToday = nextAction === "DONE";

  return (
    <DashboardShell title="Check-In / Check-Out" subtitle={room.hostelName}>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <p className="text-[13px] font-medium text-neutral-500">Today</p>
          <p className="text-sm font-semibold">{formatDate(dayKeyLocal())}</p>
          {isLoading ? (
            <>
              <Skeleton className="mt-3 h-16 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-2">
                {doneToday ? (
                  <Badge tone="green">Done for today</Badge>
                ) : today ? (
                  <Badge tone="amber">Checked in</Badge>
                ) : (
                  <Badge tone="gray">Not checked in</Badge>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-surface-border p-3">
                  <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <LogIn className="h-3.5 w-3.5" /> Check-in
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {today ? formatTimeOfDay(today.checkInAt) : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-surface-border p-3">
                  <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <LogOut className="h-3.5 w-3.5" /> Check-out
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {today?.checkOutAt ? formatTimeOfDay(today.checkOutAt) : "—"}
                  </p>
                </div>
              </div>
              {today?.checkOutAt && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-neutral-600">
                  <Timer className="h-4 w-4" /> Stayed{" "}
                  {durationLabel(today.checkInAt, today.checkOutAt)}
                </p>
              )}
              <div className="mt-5">
                {doneToday ? (
                  <div className="rounded-2xl border border-brand bg-brand-muted/50 p-4 text-center">
                    <CalendarCheck2 className="mx-auto h-6 w-6" aria-hidden />
                    <p className="mt-1 text-sm font-semibold">Attendance complete for today.</p>
                    <p className="text-xs text-neutral-600">One record per day.</p>
                  </div>
                ) : (
                  <SlideToAction
                    mode={nextAction === "CHECK_IN" ? "CHECK_IN" : "CHECK_OUT"}
                    loading={busy}
                    onComplete={handleComplete}
                  />
                )}
              </div>
            </>
          )}
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="My activity" subtitle="Your check-in and check-out times" />
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : history.length === 0 ? (
            <p className="p-5 text-sm text-neutral-500">No activity yet. Slide to check in.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {history.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{formatDate(r.date)}</span>
                    <span className="block text-xs text-neutral-500">
                      In {formatTimeOfDay(r.checkInAt)}
                      {r.checkOutAt ? ` · Out ${formatTimeOfDay(r.checkOutAt)}` : " · Inside"}
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
      </div>
    </DashboardShell>
  );
}
