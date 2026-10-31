"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, CalendarClock, CheckCircle2, QrCode, Receipt, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getHostelId } from "@/lib/axios";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useHostelFacilities, useMyFees } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";
import { SlideToAction } from "@/components/attendance/SlideToAction";
import { useMyAttendance } from "@/lib/useAttendance";
import { checkIn, checkOut } from "@/lib/attendance-actions";
import {
  formatTimeOfDay,
  type AttendanceIdentity,
  type AttendanceRecord,
} from "@/lib/attendance-types";

export default function ResidentDashboardPage() {
  const { user } = useAuth();
  const room = useMyRoomSummary();
  const fees = useMyFees();
  const { success, error: toastError } = useToast();
  const [attendanceBusy, setAttendanceBusy] = useState(false);

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

  const {
    today: attendanceToday,
    isLoading: attendanceLoading,
    nextAction: attendanceNextAction,
    refresh: refreshAttendance,
  } = useMyAttendance(identity);

  async function handleAttendance() {
    if (attendanceBusy) return;
    if (!identity) {
      toastError("Not ready", "Session loading, please try again in a moment.");
      return;
    }
    setAttendanceBusy(true);
    try {
      const isCheckIn = attendanceNextAction === "CHECK_IN";
      const res = isCheckIn ? await checkIn(identity) : await checkOut(identity);

      if ("reason" in res && typeof (res as { reason?: unknown }).reason === "string") {
        const errObj = res as { reason: string; message?: unknown };
        const errMsg = typeof errObj.message === "string" ? errObj.message : "";
        if (errObj.reason === "ALREADY_CHECKED_IN" || errObj.reason === "ALREADY_CHECKED_OUT") {
          await refreshAttendance();
          success(isCheckIn ? "Already checked in" : "Already checked out", errMsg || undefined);
        } else {
          toastError(
            isCheckIn ? "Check-in failed" : "Check-out failed",
            errMsg || "Please allow location/GPS access."
          );
        }
      } else {
        const record = res as AttendanceRecord;
        const timeStr = isCheckIn
          ? formatTimeOfDay(record.checkInAt)
          : formatTimeOfDay(record.checkOutAt || record.checkInAt);
        success(
          isCheckIn ? "Checked in successfully!" : "Checked out successfully!",
          isCheckIn ? `In at ${timeStr}.` : `Out at ${timeStr}.`
        );
        await refreshAttendance();
      }
    } catch (err: unknown) {
      toastError("Action failed", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAttendanceBusy(false);
    }
  }

  const facilities = useHostelFacilities(room.hostelId);
  const feeList = fees.data ?? [];
  const due = feeList.find((f) => f.status !== "PAID") ?? null;
  const hostelName = room.hostelName || user?.hostelName || "My Hostel";
  const subtitle = `${hostelName} · ${room.roomLabel}`;
  const retryAll = () => {
    room.retry();
    fees.retry();
  };
  return (
    <DashboardShell title="My Dashboard" subtitle={subtitle}>
      <div className="space-y-5">
        {(room.error || fees.error) && (
          <ErrorState
            title="Some sections couldn't load"
            description={(room.error ?? fees.error)?.message ?? ""}
            onRetry={retryAll}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-neutral-700">My Room</p>
            {room.isLoading ? (
              <>
                <Skeleton className="mt-2 h-6 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
              </>
            ) : room.myRoom ? (
              <>
                <p className="mt-1.5 text-xl font-bold text-neutral-900">
                  Room {room.myRoom.roomNumber} · {room.myRoom.bedNumber}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-neutral-600">
                  Floor {room.myRoom.floor} · Flat {room.myRoom.flat}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold text-neutral-900">Not assigned</p>
                <p className="mt-0.5 text-xs font-semibold text-neutral-600">Ask your warden.</p>
              </>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-neutral-700">Monthly Rent</p>
            {fees.isLoading ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold text-neutral-900">
                  {due ? formatCurrency(due.amount) : "All clear"}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-neutral-600">
                  {due?.dueDate ? `Due by ${formatDate(due.dueDate)}` : `${feeList.length} bills`}
                </p>
              </>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-neutral-700">Next Payment</p>
            {fees.isLoading ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : due ? (
              <>
                <p className="mt-1.5 text-xl font-bold text-neutral-900">
                  {due.dueDate ? formatDate(due.dueDate) : (due.month ?? "Due")}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-neutral-600">
                  {formatCurrency(due.amount)}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold text-neutral-900">No dues</p>
                <p className="mt-0.5 text-xs font-semibold text-neutral-600">Up to date.</p>
              </>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-neutral-700">Payment Status</p>
            {fees.isLoading ? (
              <Skeleton className="mt-2 h-7 w-20" />
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold text-neutral-900">
                  {due ? due.status : "PAID"}
                </p>
                <Badge tone={statusTone(due ? due.status : "PAID")} className="mt-2 font-bold">
                  {due ? due.status : "CLEAR"}
                </Badge>
              </>
            )}
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="Facilities" subtitle={`At ${hostelName}`} />
            {facilities.isLoading ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (facilities.data ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm font-semibold text-neutral-600">
                No facilities published yet.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {(facilities.data ?? []).slice(0, 5).map((f) => (
                  <li key={f.id} className="px-5 py-3.5">
                    <p className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                      {f.title}
                      <Badge tone="gray" className="font-semibold">
                        {f.tag}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-neutral-600">
                      {f.description || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-[15px] font-bold text-neutral-900">
                  <CalendarClock className="h-4 w-4 text-brand-ink" /> Today&apos;s Check-In
                </p>
                {attendanceLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : attendanceNextAction === "DONE" ? (
                  <Badge tone="green" className="font-bold">
                    Done for today
                  </Badge>
                ) : attendanceToday ? (
                  <Badge tone="amber" className="font-bold">
                    Checked in
                  </Badge>
                ) : (
                  <Badge tone="gray" className="font-bold">
                    Not checked in
                  </Badge>
                )}
              </div>

              {attendanceLoading ? (
                <div className="mt-3">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
              ) : attendanceNextAction === "DONE" ? (
                <div className="mt-3 rounded-2xl border border-brand bg-brand-muted/40 p-3.5 text-center">
                  <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" aria-hidden />
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    Attendance complete for today
                  </p>
                  <p className="text-xs font-semibold text-neutral-600">
                    In: {formatTimeOfDay(attendanceToday?.checkInAt)} · Out:{" "}
                    {formatTimeOfDay(attendanceToday?.checkOutAt)}
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <SlideToAction
                    mode={attendanceNextAction === "CHECK_IN" ? "CHECK_IN" : "CHECK_OUT"}
                    loading={attendanceBusy}
                    onComplete={handleAttendance}
                  />
                  {attendanceToday?.checkInAt && (
                    <p className="text-center text-xs font-semibold text-neutral-600">
                      Checked in at {formatTimeOfDay(attendanceToday.checkInAt)}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-surface-border pt-3">
                <Link
                  href="/resident/attendance"
                  className="text-xs font-bold text-neutral-800 hover:text-black hover:underline"
                >
                  View full attendance log &rarr;
                </Link>
              </div>
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[15px] font-bold text-neutral-900">
                <BedDouble className="h-4 w-4" /> My Room
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-700">{room.roomLabel}</p>
              <div className="mt-3 flex gap-2">
                <Link href="/resident/room">
                  <Button size="sm" variant="outline" className="font-semibold">
                    Room details
                  </Button>
                </Link>
                <Link href="/resident/payments">
                  <Button size="sm" className="font-bold">
                    <QrCode className="h-3.5 w-3.5" /> Pay via QR
                  </Button>
                </Link>
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Recent payments"
                subtitle="Latest fee records"
                action={
                  <Link
                    href="/resident/history"
                    className="text-[13px] font-bold text-neutral-800 hover:underline"
                  >
                    History
                  </Link>
                }
              />
              {fees.isLoading ? (
                <p className="px-5 py-6 text-sm font-semibold text-neutral-600" role="status">
                  Loading…
                </p>
              ) : feeList.length === 0 ? (
                <p className="px-5 py-6 text-sm font-semibold text-neutral-600">No bills yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {feeList.slice(0, 3).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <Receipt className="h-4 w-4 shrink-0 text-neutral-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-neutral-900">
                          {p.month ?? "Fee"}
                        </span>
                        <span className="block text-xs font-semibold text-neutral-600">
                          {p.dueDate ? formatDate(p.dueDate) : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold text-neutral-900">
                          {formatCurrency(p.amount)}
                        </span>
                        <Badge tone={statusTone(p.status)} className="mt-0.5 font-bold">
                          {p.status}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="flex flex-col gap-3 border-dashed p-5 text-sm text-neutral-700 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-5 w-5 shrink-0 text-neutral-800" />
                {due ? (
                  <span>
                    Next rent due{" "}
                    <strong className="text-neutral-900">
                      {due.dueDate ? formatDate(due.dueDate) : (due.month ?? "")}
                    </strong>{" "}
                    —{" "}
                    <span className="font-bold text-neutral-900">{formatCurrency(due.amount)}</span>
                    .
                  </span>
                ) : (
                  <span>
                    <strong className="text-neutral-900">All clear 🎉</strong> — no pending dues.
                  </span>
                )}
              </div>
              {due && (
                <Link href="/resident/payments">
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 text-xs font-bold"
                  >
                    <QrCode className="h-3.5 w-3.5 text-brand-ink" /> View QR Code
                  </Button>
                </Link>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
