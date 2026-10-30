"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  Building2,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { hostelGhar, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { Booking, CreateBookingPayload } from "@/lib/api-types";
import type { Hostel } from "@/types/hostel";
import { formatDate } from "@/lib/utils";

export default function ResidentBookingsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // New Booking Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>("");
  const [checkInDate, setCheckInDate] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Cancelling state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // 1. Fetch My Bookings: GET /bookings/my-bookings
  const loadMyBookings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await hostelGhar.bookings.myBookings();
      const items = toPaginated<Booking>(res.data).items;
      setBookings(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load your bookings";
      setLoadError(msg);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyBookings();
  }, [loadMyBookings]);

  // Load Hostels list for booking dropdown
  const loadHostels = useCallback(async () => {
    try {
      const res = await hostelGhar.hostels.list({ limit: 50 });
      const items = toPaginated<Hostel>(res.data).items;
      setHostels(items);
      if (items.length > 0) {
        setSelectedHostelId((current) => current || items[0].id);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  // 2. Create Booking: POST /bookings
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostelId || !checkInDate) {
      toastError("Please select a hostel and check-in date");
      return;
    }

    setIsSubmitting(true);
    const payload: CreateBookingPayload = {
      hostelId: selectedHostelId,
      checkInDate,
      remarks: remarks.trim() || undefined,
    };

    try {
      await hostelGhar.bookings.create(payload);
      success("Booking request submitted successfully!");
      setIsModalOpen(false);
      setCheckInDate("");
      setRemarks("");
      loadMyBookings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit booking";
      toastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Cancel Booking: DELETE /bookings/:id
  const handleCancelBooking = async () => {
    if (!cancellingId) return;
    setIsCancelling(true);
    try {
      await hostelGhar.bookings.cancel(cancellingId);
      success("Booking cancelled successfully");
      setCancellingId(null);
      loadMyBookings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel booking";
      toastError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <DashboardShell
      title="My Hostel Bookings"
      subtitle="View and manage your hostel booking requests"
    >
      <Protected roles={["RESIDENT"]}>
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="shadow-xs flex flex-col gap-3 rounded-xl border border-surface-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Your Booking History</h2>
              <p className="text-xs text-neutral-500">
                Track and manage your hostel booking requests
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMyBookings}
                className="gap-1 text-xs"
              >
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus size={15} />
                Book a Hostel
              </Button>
            </div>
          </div>

          {/* Bookings List from Database */}
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2].map((i) => (
                  <div key={i} className="flex justify-between border-b pb-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="p-6">
                <ErrorState
                  title="Failed to load your bookings"
                  description={loadError}
                  onRetry={loadMyBookings}
                />
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No bookings found"
                  description="You have not submitted any hostel booking requests yet."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsModalOpen(true)}
                      className="gap-1.5"
                    >
                      <Plus size={15} />
                      Book a Hostel Now
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-neutral-600">
                  <thead className="border-b border-surface-border bg-neutral-50/50 text-[12px] font-semibold uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-5 py-3">Hostel</th>
                      <th className="px-5 py-3">Check-In Date</th>
                      <th className="px-5 py-3">Remarks</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {bookings.map((b) => {
                      const isPending = b.status === "PENDING";
                      const isConfirmed = b.status === "CONFIRMED" || b.status === "APPROVED";

                      return (
                        <tr key={b.id} className="transition-colors hover:bg-neutral-50/80">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-neutral-900">
                              {b.hostel?.name || b.hostelName || "Hostel"}
                            </div>
                            <div className="font-mono text-xs text-neutral-400">ID: {b.id}</div>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1 font-medium text-neutral-900">
                              <Calendar size={13} className="text-neutral-400" />
                              {formatDate(b.checkInDate)}
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <p className="max-w-xs truncate text-xs text-neutral-700">
                              {b.remarks || "—"}
                            </p>
                          </td>

                          <td className="px-5 py-3.5">
                            {isPending ? (
                              <Badge tone="amber" className="gap-1">
                                <Clock size={11} />
                                Pending
                              </Badge>
                            ) : isConfirmed ? (
                              <Badge tone="green" className="gap-1">
                                <CheckCircle2 size={11} />
                                {b.status}
                              </Badge>
                            ) : (
                              <Badge tone="red" className="gap-1">
                                <XCircle size={11} />
                                {b.status}
                              </Badge>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            {isPending && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCancellingId(b.id)}
                                className="h-8 text-xs text-red-600 hover:bg-red-50"
                              >
                                Cancel Request
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Cancel Confirmation Modal */}
          {cancellingId && (
            <Modal
              open={Boolean(cancellingId)}
              onClose={() => setCancellingId(null)}
              title="Cancel Booking Request"
              description="Are you sure you want to cancel your booking request?"
              size="sm"
            >
              <div className="space-y-4">
                <p className="text-xs text-neutral-600">
                  This action cannot be undone. Your request will be withdrawn.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCancellingId(null)}>
                    Keep Booking
                  </Button>
                  <Button variant="danger" onClick={handleCancelBooking} loading={isCancelling}>
                    Yes, Cancel Booking
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Book Hostel Modal */}
          <Modal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Book a Hostel"
            description="Select your preferred hostel and expected check-in date"
            size="md"
          >
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-800">
                  Choose Hostel
                </label>
                <select
                  value={selectedHostelId}
                  onChange={(e) => setSelectedHostelId(e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand"
                  required
                >
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.city ? `(${h.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Expected Check-In Date *"
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                required
              />

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-800">
                  Remarks / Room Needs (Optional)
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Need single room, ground floor preferred"
                  className="w-full rounded-md border border-neutral-300 bg-white p-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting}>
                  Submit Booking
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      </Protected>
    </DashboardShell>
  );
}
