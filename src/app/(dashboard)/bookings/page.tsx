"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  BedDouble,
  Trash2,
  Download,
  AlertCircle,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getHostelId } from "@/lib/axios";
import {
  hostelGhar,
  normalizeOwnerDashboard,
  toPaginated,
  unwrap,
  validHostelId,
} from "@/lib/hostelGhar";
import type { Booking, BookingStatus } from "@/lib/api-types";
import type { Hostel } from "@/types/hostel";
import { formatDate } from "@/lib/utils";

export default function OwnerBookingsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  // Hostels State (Loaded strictly from Database)
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>("");
  const [hostelsLoading, setHostelsLoading] = useState<boolean>(true);

  // Bookings State (Loaded strictly from GET /bookings/hostels/:hostelId)
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected Booking for Detail / Delete Modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // 1. Load Owner's Hostels strictly from the database
  const loadHostels = useCallback(async () => {
    setHostelsLoading(true);
    const discoveredHostels: Hostel[] = [];
    const discoveredIds = new Set<string>();

    const directId = validHostelId(user?.hostelId) ?? validHostelId(getHostelId());
    if (directId) {
      discoveredIds.add(directId);
    }

    try {
      const dashRes = await hostelGhar.owner.dashboard();
      const dash = normalizeOwnerDashboard(dashRes.data);
      if (Array.isArray(dash?.hostels)) {
        dash.hostels.forEach((h) => {
          const hid = validHostelId(h.hostelId);
          if (hid) discoveredIds.add(hid);
        });
      }
    } catch {
      // ignore
    }

    try {
      const formHostelsRes = await hostelGhar.owner.residentFormHostels();
      const formItems = toPaginated<{ id: string; name: string }>(unwrap(formHostelsRes.data)).items;
      formItems.forEach((h) => {
        const hid = validHostelId(h.id);
        if (hid) discoveredIds.add(hid);
      });
    } catch {
      // ignore
    }

    // Only fallback to list if no owner-specific hostels were discovered
    if (discoveredIds.size === 0) {
      try {
        const listRes = await hostelGhar.hostels.list({ limit: 50 });
        const items = toPaginated<Hostel>(listRes.data).items;
        items.forEach((h) => {
          if (h.id && !discoveredIds.has(h.id)) {
            discoveredIds.add(h.id);
            discoveredHostels.push(h);
          }
        });
      } catch {
        // ignore
      }
    }

    for (const hid of discoveredIds) {
      if (!discoveredHostels.some((h) => h.id === hid)) {
        try {
          const res = await hostelGhar.hostels.get(hid);
          const detail = unwrap<Hostel>(res.data);
          if (detail && detail.id) {
            discoveredHostels.push(detail);
          }
        } catch {
          // ignore
        }
      }
    }

    setHostels(discoveredHostels);

    if (discoveredHostels.length > 0) {
      const initialId =
        directId && discoveredHostels.some((h) => h.id === directId)
          ? directId
          : discoveredHostels[0].id;
      setSelectedHostelId(initialId);
    } else if (directId) {
      setSelectedHostelId(directId);
    }

    setHostelsLoading(false);
  }, [user]);

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  // Active hostel object
  const activeHostel = useMemo(() => {
    return (
      hostels.find((h) => h.id === selectedHostelId) || (hostels.length > 0 ? hostels[0] : null)
    );
  }, [hostels, selectedHostelId]);

  // 2. Fetch Actual Bookings strictly from Database: GET /bookings/hostels/:hostelId
  const loadBookings = useCallback(async (hostelId: string) => {
    if (!hostelId) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const res = await hostelGhar.bookings.hostelBookings(hostelId);
      const fetched = toPaginated<Booking>(res.data).items;
      // Strictly enforce that only bookings belonging to this specific hostel are stored
      const matched = fetched.filter((b) => {
        const bHostelId = b.hostelId || b.hostel?.id;
        return !bHostelId || bHostelId === hostelId;
      });
      setBookings(matched);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load bookings from database";
      setLoadError(message);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedHostelId) {
      loadBookings(selectedHostelId);
    }
  }, [selectedHostelId, loadBookings]);

  // Update Status: PATCH /bookings/:id/status
  const handleUpdateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      await hostelGhar.bookings.updateStatus(bookingId, { status: newStatus });
      success(`Booking status updated to ${newStatus}`);
      if (selectedHostelId) {
        loadBookings(selectedHostelId);
      }
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not update status";
      toastError(msg);
    }
  };

  // Delete Booking: DELETE /bookings/:id
  const handleDeleteBooking = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await hostelGhar.bookings.delete(deletingId);
      success("Booking deleted successfully");
      setDeletingId(null);
      if (selectedBooking?.id === deletingId) {
        setSelectedBooking(null);
      }
      if (selectedHostelId) {
        loadBookings(selectedHostelId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete booking";
      toastError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Bookings strictly matching the selected hostel and active filters
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Must strictly belong to the selected hostel
      const bHostelId = b.hostelId || b.hostel?.id;
      if (selectedHostelId && bHostelId && bHostelId !== selectedHostelId) {
        return false;
      }

      const studentName =
        b.user?.name ||
        [b.user?.firstName, b.user?.lastName].filter(Boolean).join(" ") ||
        b.userName ||
        b.studentName ||
        "";
      const studentPhone = b.user?.phone || b.studentPhone || "";
      const studentEmail = b.user?.email || b.studentEmail || "";
      const remarks = b.remarks || "";

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        studentName.toLowerCase().includes(q) ||
        studentPhone.toLowerCase().includes(q) ||
        studentEmail.toLowerCase().includes(q) ||
        remarks.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "ALL" ||
        b.status.toUpperCase() === statusFilter.toUpperCase() ||
        (statusFilter === "APPROVED" && b.status === "CONFIRMED") ||
        (statusFilter === "CONFIRMED" && b.status === "APPROVED");

      return matchesSearch && matchesStatus;
    });
  }, [bookings, selectedHostelId, searchQuery, statusFilter]);

  // Statistics scoped strictly to selected hostel
  const stats = useMemo(() => {
    const scopedBookings = selectedHostelId
      ? bookings.filter((b) => {
          const bHostelId = b.hostelId || b.hostel?.id;
          return !bHostelId || bHostelId === selectedHostelId;
        })
      : bookings;
    const total = scopedBookings.length;
    const pending = scopedBookings.filter((b) => b.status === "PENDING").length;
    const confirmed = scopedBookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "APPROVED"
    ).length;
    const rejected = scopedBookings.filter(
      (b) => b.status === "REJECTED" || b.status === "CANCELLED"
    ).length;
    return { total, pending, confirmed, rejected };
  }, [bookings, selectedHostelId]);

  // Helper to extract student contact
  const getStudentInfo = (b: Booking) => {
    const name =
      b.user?.name ||
      [b.user?.firstName, b.user?.lastName].filter(Boolean).join(" ") ||
      b.userName ||
      b.studentName ||
      "Student / User";
    const email = b.user?.email || b.studentEmail || "";
    const phone = b.user?.phone || b.studentPhone || "";
    return { name, email, phone };
  };

  // Export CSV of Database Bookings
  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      toastError("No bookings to export");
      return;
    }
    const headers = [
      "Booking ID",
      "Hostel ID",
      "Student Name",
      "Email",
      "Phone",
      "Check-In Date",
      "Status",
      "Remarks",
      "Created At",
    ];
    const rows = filteredBookings.map((b) => {
      const info = getStudentInfo(b);
      return [
        `"${b.id}"`,
        `"${b.hostelId}"`,
        `"${info.name}"`,
        `"${info.email}"`,
        `"${info.phone}"`,
        `"${b.checkInDate}"`,
        `"${b.status}"`,
        `"${(b.remarks || "").replace(/"/g, '""')}"`,
        `"${b.createdAt || ""}"`,
      ];
    });
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookings_${selectedHostelId || "hostel"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success("Bookings exported to CSV");
  };

  return (
    <DashboardShell
      title="Hostel Bookings"
      subtitle={`Live booking requests for ${activeHostel?.name || "your hostel"}`}
    >
      <Protected permission="VIEW_HOSTEL">
        <div className="space-y-6">
          {/* Top Hostel Selector Bar */}
          <div className="shadow-xs flex flex-col gap-4 rounded-xl border border-surface-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand-ink">
                <Building2 size={20} />
              </span>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Select Hostel
                </label>
                <div className="relative mt-0.5">
                  <select
                    value={selectedHostelId}
                    onChange={(e) => setSelectedHostelId(e.target.value)}
                    disabled={hostelsLoading}
                    className="h-9 min-w-[240px] rounded-lg border border-neutral-300 bg-neutral-50 pl-3 pr-8 text-sm font-bold text-neutral-900 outline-none transition-colors hover:border-brand focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand"
                  >
                    {hostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} {h.city ? `(${h.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeHostel && (
                <div className="hidden items-center gap-2 border-l border-neutral-200 pl-4 sm:flex">
                  <span className="flex items-center gap-1 text-xs text-neutral-500">
                    <MapPin size={13} className="text-neutral-400" />
                    {activeHostel.address || activeHostel.city || "Kathmandu"}
                  </span>
                  {activeHostel.type && (
                    <Badge tone={activeHostel.type === "GIRLS" ? "blue" : "green"}>
                      {activeHostel.type}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => selectedHostelId && loadBookings(selectedHostelId)}
                title="Refresh Bookings"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-neutral-500">Total Bookings</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.total}</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">Total requests</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <CalendarCheck2 size={20} />
              </span>
            </Card>

            <Card className="flex items-center justify-between border-amber-200 bg-amber-50/40 p-4">
              <div>
                <p className="text-xs font-medium text-amber-800">Pending Review</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{stats.pending}</p>
                <p className="mt-0.5 text-[11px] text-amber-700">Requires owner action</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Clock size={20} />
              </span>
            </Card>

            <Card className="flex items-center justify-between border-emerald-200 bg-emerald-50/40 p-4">
              <div>
                <p className="text-xs font-medium text-emerald-800">Confirmed / Approved</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{stats.confirmed}</p>
                <p className="mt-0.5 text-[11px] text-emerald-700">Ready for resident enroll</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <CheckCircle2 size={20} />
              </span>
            </Card>

            <Card className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-neutral-500">Rejected / Cancelled</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.rejected}</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">Past or rejected</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <XCircle size={20} />
              </span>
            </Card>
          </div>

          {/* Search & Filter Toolbar */}
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  placeholder="Search bookings by student name, email, phone, remarks, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 outline-none transition-colors hover:border-neutral-300 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                  {(["ALL", "PENDING", "CONFIRMED", "REJECTED"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                        statusFilter === s
                          ? "shadow-xs bg-white text-neutral-900"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      {s === "ALL"
                        ? "All"
                        : s === "CONFIRMED"
                          ? "Confirmed"
                          : s === "PENDING"
                            ? "Pending"
                            : "Rejected"}
                    </button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="gap-1 text-xs"
                >
                  <Download size={14} />
                  Export
                </Button>
              </div>
            </div>
          </Card>

          {/* Bookings Table */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-border bg-neutral-50/60 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Bookings ({filteredBookings.length})
                </h3>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4 p-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-neutral-100 pb-3"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="p-6">
                <ErrorState
                  title="Failed to load bookings"
                  description={loadError}
                  onRetry={() => selectedHostelId && loadBookings(selectedHostelId)}
                />
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No bookings found"
                  description={
                    searchQuery || statusFilter !== "ALL"
                      ? "No bookings match your current search or status filters."
                      : `No booking requests have been submitted for ${activeHostel?.name || "this hostel"} yet. When a booking is submitted, it will appear here.`
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-neutral-600">
                  <thead className="border-b border-surface-border bg-neutral-50/50 text-[12px] font-semibold uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-5 py-3">User / Student</th>
                      <th className="px-5 py-3">Check-In Date</th>
                      <th className="px-5 py-3">Remarks / Requirements</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {filteredBookings.map((b) => {
                      const info = getStudentInfo(b);
                      const isPending = b.status === "PENDING";
                      const isConfirmed = b.status === "CONFIRMED" || b.status === "APPROVED";

                      return (
                        <tr key={b.id} className="transition-colors hover:bg-neutral-50/80">
                          {/* Student Details */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-muted text-sm font-bold text-brand-ink">
                                {info.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </div>
                              <div>
                                <div className="font-semibold text-neutral-900">{info.name}</div>
                                <div className="flex items-center gap-2 text-xs text-neutral-500">
                                  {info.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone size={11} className="text-neutral-400" />
                                      {info.phone}
                                    </span>
                                  )}
                                  {info.email && (
                                    <span className="hidden items-center gap-1 sm:flex">
                                      <Mail size={11} className="text-neutral-400" />
                                      {info.email}
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-[10px] text-neutral-400">
                                  ID: {b.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Check-In Date */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1 font-medium text-neutral-900">
                              <Calendar size={13} className="text-neutral-400" />
                              {formatDate(b.checkInDate)}
                            </div>
                            {b.createdAt && (
                              <div className="text-[11px] text-neutral-400">
                                Requested {formatDate(b.createdAt)}
                              </div>
                            )}
                          </td>

                          {/* Remarks */}
                          <td className="px-5 py-3.5">
                            <p className="max-w-xs truncate text-xs text-neutral-700">
                              {b.remarks || "—"}
                            </p>
                          </td>

                          {/* Status */}
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

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(b.id, "APPROVED")}
                                    className="h-8 bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                    title="Approve booking"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(b.id, "REJECTED")}
                                    className="h-8 px-2 text-xs text-red-600 hover:border-red-300 hover:bg-red-50"
                                    title="Reject booking"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}

                              {isConfirmed && (
                                <Link
                                  href={`/residents/add?name=${encodeURIComponent(
                                    info.name
                                  )}&phone=${encodeURIComponent(
                                    info.phone
                                  )}&email=${encodeURIComponent(
                                    info.email
                                  )}&hostelId=${b.hostelId}`}
                                >
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1 text-xs font-medium text-brand-ink"
                                    title="Enroll resident into hostel"
                                  >
                                    <UserCheck size={13} />
                                    Add as Resident
                                  </Button>
                                </Link>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedBooking(b)}
                                className="h-8 px-2 text-neutral-500 hover:text-neutral-900"
                                title="View details"
                              >
                                <Eye size={15} />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingId(b.id)}
                                className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                                title="Delete booking"
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Delete Confirmation Modal */}
          {deletingId && (
            <Modal
              open={Boolean(deletingId)}
              onClose={() => setDeletingId(null)}
              title="Delete Booking"
              description="Are you sure you want to delete this booking request?"
              size="sm"
            >
              <div className="space-y-4">
                <p className="text-sm text-neutral-600">
                  This action permanently removes the booking request from your hostel.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeletingId(null)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={handleDeleteBooking} loading={isDeleting}>
                    Yes, Delete
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* Details Modal */}
          {selectedBooking && (
            <Modal
              open={Boolean(selectedBooking)}
              onClose={() => setSelectedBooking(null)}
              title="Booking Request Details"
              description={`Booking ID: ${selectedBooking.id}`}
              size="md"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
                  <div>
                    <span className="text-xs text-neutral-500">Status</span>
                    <div className="mt-0.5">
                      {selectedBooking.status === "PENDING" ? (
                        <Badge tone="amber">Pending Approval</Badge>
                      ) : selectedBooking.status === "CONFIRMED" ||
                        selectedBooking.status === "APPROVED" ? (
                        <Badge tone="green">{selectedBooking.status}</Badge>
                      ) : (
                        <Badge tone="red">{selectedBooking.status}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-neutral-500">Check-In Date</span>
                    <p className="text-sm font-semibold text-neutral-900">
                      {formatDate(selectedBooking.checkInDate)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Student / User Information
                  </h4>
                  <div className="space-y-2 rounded-lg border border-neutral-200 p-3 text-sm">
                    {(() => {
                      const info = getStudentInfo(selectedBooking);
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-neutral-500">Name</span>
                            <span className="font-semibold text-neutral-900">{info.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-neutral-500">Contact Phone</span>
                            <span className="text-neutral-900">
                              {info.phone || "Not specified"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-neutral-500">Email</span>
                            <span className="text-neutral-900">
                              {info.email || "Not specified"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-neutral-500">User ID</span>
                            <span className="font-mono text-xs text-neutral-600">
                              {selectedBooking.userId || "—"}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Booking Request Details
                  </h4>
                  <div className="space-y-2 rounded-lg border border-neutral-200 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-xs text-neutral-500">Hostel ID</span>
                      <span className="font-mono text-xs text-neutral-600">
                        {selectedBooking.hostelId}
                      </span>
                    </div>
                    {selectedBooking.remarks && (
                      <div className="border-t border-neutral-100 pt-2">
                        <span className="mb-1 block text-xs text-neutral-500">Remarks:</span>
                        <p className="rounded bg-neutral-50 p-2 text-xs text-neutral-800">
                          {selectedBooking.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
                  <div className="flex items-center gap-2">
                    {selectedBooking.status === "PENDING" && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleUpdateStatus(selectedBooking.id, "APPROVED")}
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(selectedBooking.id, "REJECTED")}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBooking(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      </Protected>
    </DashboardShell>
  );
}
