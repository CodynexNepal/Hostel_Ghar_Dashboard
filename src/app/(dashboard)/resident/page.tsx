"use client";
import Link from "next/link";
import { BedDouble, CalendarClock, Receipt, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useHostelFacilities, useMyFees } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";

export default function ResidentDashboardPage() {
  const { user } = useAuth();
  const room = useMyRoomSummary();
  const fees = useMyFees();
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
            <p className="text-[13px] font-medium text-neutral-500">My Room</p>
            {room.isLoading ? (
              <>
                <Skeleton className="mt-2 h-6 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
              </>
            ) : room.myRoom ? (
              <>
                <p className="mt-1.5 text-xl font-bold">
                  Room {room.myRoom.roomNumber} · {room.myRoom.bedNumber}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Floor {room.myRoom.floor} · Flat {room.myRoom.flat}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold">Not assigned</p>
                <p className="mt-0.5 text-xs text-neutral-400">Ask your warden.</p>
              </>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-medium text-neutral-500">Monthly Rent</p>
            {fees.isLoading ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold">
                  {due ? formatCurrency(due.amount) : "All clear"}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {due?.dueDate ? `Due by ${formatDate(due.dueDate)}` : `${feeList.length} bills`}
                </p>
              </>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-medium text-neutral-500">Next Payment</p>
            {fees.isLoading ? (
              <Skeleton className="mt-2 h-7 w-28" />
            ) : due ? (
              <>
                <p className="mt-1.5 text-xl font-bold">
                  {due.dueDate ? formatDate(due.dueDate) : (due.month ?? "Due")}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">{formatCurrency(due.amount)}</p>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold">No dues</p>
                <p className="mt-0.5 text-xs text-neutral-400">Up to date.</p>
              </>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-[13px] font-medium text-neutral-500">Payment Status</p>
            {fees.isLoading ? (
              <Skeleton className="mt-2 h-7 w-20" />
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold">{due ? due.status : "PAID"}</p>
                <Badge tone={statusTone(due ? due.status : "PAID")} className="mt-2">
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
              <p className="px-5 py-6 text-sm text-neutral-500">No facilities published yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {(facilities.data ?? []).slice(0, 5).map((f) => (
                  <li key={f.id} className="px-5 py-3.5">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {f.title}
                      <Badge tone="gray">{f.tag}</Badge>
                    </p>
                    <p className="mt-0.5 text-[13px] text-neutral-500">{f.description || "—"}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                <BedDouble className="h-4 w-4" /> My Room
              </p>
              <p className="mt-2 text-sm text-neutral-600">{room.roomLabel}</p>
              <div className="mt-3 flex gap-2">
                <Link href="/resident/room">
                  <Button size="sm" variant="outline">
                    Room details
                  </Button>
                </Link>
                <Link href="/resident/payments">
                  <Button size="sm">
                    <Wallet className="h-3.5 w-3.5" /> Pay rent
                  </Button>
                </Link>
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Recent payments"
                subtitle="GET /resident/fees"
                action={
                  <Link
                    href="/resident/history"
                    className="text-[13px] font-semibold hover:underline"
                  >
                    History
                  </Link>
                }
              />
              {fees.isLoading ? (
                <p className="px-5 py-6 text-sm text-neutral-500" role="status">
                  Loading…
                </p>
              ) : feeList.length === 0 ? (
                <p className="px-5 py-6 text-sm text-neutral-500">No bills yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {feeList.slice(0, 3).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <Receipt className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {p.month ?? "Fee"}
                        </span>
                        <span className="block text-xs text-neutral-500">
                          {p.dueDate ? formatDate(p.dueDate) : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold">{formatCurrency(p.amount)}</span>
                        <Badge tone={statusTone(p.status)} className="mt-0.5">
                          {p.status}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="flex items-center gap-3 border-dashed p-5 text-sm text-neutral-600">
              <CalendarClock className="h-5 w-5 shrink-0" />
              {due ? (
                <span>
                  Next rent due{" "}
                  <strong>{due.dueDate ? formatDate(due.dueDate) : (due.month ?? "")}</strong> —{" "}
                  {formatCurrency(due.amount)}.
                </span>
              ) : (
                <span>
                  <strong>All clear 🎉</strong> — no pending dues.
                </span>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
