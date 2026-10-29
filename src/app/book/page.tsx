"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  LogIn,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { hostelGhar, toPaginated, unwrap } from "@/lib/hostelGhar";
import type { Booking, CreateBookingPayload } from "@/lib/api-types";
import type { Hostel } from "@/types/hostel";
import { formatDate } from "@/lib/utils";

const ROOM_SHARING_OPTIONS = [
  "Single Room (1 Bed)",
  "Double Sharing (2 Beds)",
  "Triple Sharing (3 Beds)",
  "Dormitory (4+ Beds)",
];

export default function PublicBookingPortal() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  // Hostels loaded strictly from database
  const [hostelsList, setHostelsList] = useState<Hostel[]>([]);
  const [isLoadingHostels, setIsLoadingHostels] = useState<boolean>(true);
  const [hostelError, setHostelError] = useState<string | null>(null);

  // Selected hostel
  const [selectedHostelId, setSelectedHostelId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Form Fields for POST /bookings
  const [checkInDate, setCheckInDate] = useState<string>("");
  const [roomSharing, setRoomSharing] = useState<string>("Double Sharing (2 Beds)");
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Confirmed booking returned from database
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);

  // 1. Fetch real hostels from database (GET /hostels)
  const loadHostels = async () => {
    setIsLoadingHostels(true);
    setHostelError(null);
    try {
      const res = await hostelGhar.hostels.list({ limit: 50 });
      const items = toPaginated<Hostel>(res.data).items;
      setHostelsList(items);

      if (items.length > 0) {
        // Check URL query param for pre-selection
        const urlParams = new URLSearchParams(window.location.search);
        const preId = urlParams.get("hostelId");
        const preName = urlParams.get("hostel");

        const match =
          items.find((h) => h.id === preId) ||
          items.find((h) => preName && h.name.toLowerCase().includes(preName.toLowerCase())) ||
          items[0];

        setSelectedHostelId(match.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load hostels from database";
      setHostelError(msg);
      setHostelsList([]);
    } finally {
      setIsLoadingHostels(false);
    }
  };

  useEffect(() => {
    loadHostels();
  }, []);

  const activeHostel = useMemo(() => {
    return hostelsList.find((h) => h.id === selectedHostelId) || null;
  }, [hostelsList, selectedHostelId]);

  // Filter hostels
  const filteredHostels = useMemo(() => {
    if (!searchQuery.trim()) return hostelsList;
    const q = searchQuery.toLowerCase();
    return hostelsList.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.city && h.city.toLowerCase().includes(q)) ||
        (h.address && h.address.toLowerCase().includes(q))
    );
  }, [hostelsList, searchQuery]);

  // 2. Submit Booking: POST /bookings
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedHostelId) {
      toastError("Please select a hostel to book");
      return;
    }

    if (!checkInDate) {
      toastError("Please select an expected check-in date");
      return;
    }

    // Role check: POST /bookings requires role: user / resident
    if (!user) {
      toastError("Booking requires signing in as a user. Please log in first.");
      router.push(
        `/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
      );
      return;
    }

    setIsSubmitting(true);

    const fullRemarks = [roomSharing ? `Preference: ${roomSharing}` : "", remarks.trim()]
      .filter(Boolean)
      .join(" - ");

    const payload: CreateBookingPayload = {
      hostelId: selectedHostelId,
      checkInDate,
      remarks: fullRemarks || undefined,
    };

    try {
      const res = await hostelGhar.bookings.create(payload);
      const bookingData = unwrap<Booking>(res.data);
      setCreatedBooking(bookingData);
      success("Booking created successfully in database!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create booking";
      toastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/book" className="flex items-center gap-2.5">
            <span className="shadow-xs flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-extrabold text-brand-ink">
              HG
            </span>
            <div>
              <div className="text-base font-bold tracking-tight text-neutral-900">Hostel Ghar</div>
              <div className="text-[11px] font-medium text-neutral-500">
                Official Student Booking
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            {user ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-neutral-800">
                  Logged in as <span className="text-brand-ink">{user.name}</span>
                </span>
                <Link href={user.role === "RESIDENT" ? "/resident" : "/dashboard"}>
                  <Button variant="outline" size="sm" className="text-xs">
                    My Dashboard
                  </Button>
                </Link>
              </div>
            ) : (
              <Link href="/login?redirectTo=/book">
                <Button variant="primary" size="sm" className="gap-1.5 text-xs font-semibold">
                  <LogIn size={14} />
                  Sign In to Book
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Confirmation View from Actual Database Response */}
      {createdBooking ? (
        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={36} />
            </div>

            <span className="mb-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Booking Created via POST /bookings
            </span>
            <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
              Booking Request Submitted!
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Your booking for <strong>{activeHostel?.name || "Hostel"}</strong> has been saved
              directly to the database. The hostel owner can see it in their Owner Dashboard.
            </p>

            <div className="my-6 space-y-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left">
              <div className="flex justify-between border-b border-neutral-200 pb-2 text-xs">
                <span className="text-neutral-500">Booking ID:</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {createdBooking.id}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Hostel ID:</span>
                <span className="font-mono text-neutral-800">{createdBooking.hostelId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Check-in Date:</span>
                <span className="font-semibold text-neutral-900">
                  {formatDate(createdBooking.checkInDate)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Status:</span>
                <Badge tone="amber">{createdBooking.status || "PENDING"}</Badge>
              </div>
              {createdBooking.remarks && (
                <div className="border-t border-neutral-200 pt-2 text-xs">
                  <span className="mb-0.5 block text-neutral-500">Remarks:</span>
                  <p className="rounded border border-neutral-200 bg-white p-2 text-neutral-800">
                    {createdBooking.remarks}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                variant="primary"
                onClick={() => {
                  setCreatedBooking(null);
                  setRemarks("");
                }}
              >
                Make Another Booking
              </Button>
              {user?.role === "RESIDENT" && (
                <Link href="/resident/bookings">
                  <Button variant="outline">View in My Bookings</Button>
                </Link>
              )}
            </div>
          </div>
        </main>
      ) : (
        /* Booking Page with Database Hostels */
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Hostel Booking
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Select a hostel and submit your reservation using the official booking endpoint.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Hostels List from Database (7 cols) */}
            <div className="space-y-4 lg:col-span-7">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  placeholder="Search hostels in database..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand"
                />
              </div>

              {isLoadingHostels ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4"
                    >
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : hostelError ? (
                <ErrorState
                  title="Could not load hostels from database"
                  description={hostelError}
                  onRetry={loadHostels}
                />
              ) : filteredHostels.length === 0 ? (
                <EmptyState
                  title="No hostels found in database"
                  description="Hostels registered in the database will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {filteredHostels.map((hostel) => {
                    const isSelected = hostel.id === selectedHostelId;
                    const freeBeds =
                      hostel.totalBeds != null
                        ? Math.max(0, hostel.totalBeds - (hostel.occupiedBeds || 0))
                        : null;

                    return (
                      <div
                        key={hostel.id}
                        onClick={() => setSelectedHostelId(hostel.id)}
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          isSelected
                            ? "border-brand bg-brand-muted/15 shadow-sm ring-2 ring-brand"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-neutral-900">
                                {hostel.name}
                              </h3>
                              {hostel.type && (
                                <Badge tone={hostel.type === "GIRLS" ? "blue" : "green"}>
                                  {hostel.type}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                              <MapPin size={13} className="shrink-0 text-neutral-400" />
                              {hostel.address || hostel.city || "Kathmandu"}
                            </p>
                          </div>

                          <div className="text-right">
                            {freeBeds !== null && (
                              <span className="block text-xs font-semibold text-emerald-700">
                                {freeBeds} / {hostel.totalBeds} Beds Free
                              </span>
                            )}
                            <span className="font-mono text-[11px] text-neutral-400">
                              ID: {hostel.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-xs">
                          <span className="text-neutral-500">Rooms: {hostel.totalRooms || 0}</span>
                          <Button
                            variant={isSelected ? "primary" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedHostelId(hostel.id);
                            }}
                          >
                            {isSelected ? "Selected" : "Select Hostel"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Booking Form using POST /bookings (5 cols) */}
            <div className="lg:col-span-5">
              <div className="sticky top-20 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="mb-4 border-b border-neutral-100 pb-3">
                  <h2 className="text-lg font-bold text-neutral-900">
                    Book {activeHostel ? activeHostel.name : "Hostel"}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {activeHostel?.address || activeHostel?.city || "Select a hostel on the left"}
                  </p>
                </div>

                {activeHostel && (
                  <div className="mb-4 space-y-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Hostel Name:</span>
                      <span className="font-semibold text-neutral-900">{activeHostel.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Location:</span>
                      <span className="text-neutral-800">
                        {activeHostel.address || activeHostel.city}
                      </span>
                    </div>
                    {activeHostel.totalBeds != null && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Availability:</span>
                        <span className="font-medium text-emerald-700">
                          {Math.max(0, activeHostel.totalBeds - (activeHostel.occupiedBeds || 0))} /{" "}
                          {activeHostel.totalBeds} Beds Free
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmitBooking} className="space-y-4">
                  {/* Expected Check-in Date */}
                  <Input
                    label="Expected Check-in Date *"
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    required
                  />

                  {/* Preferred Room Sharing */}
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                      Preferred Room Sharing
                    </label>
                    <select
                      value={roomSharing}
                      onChange={(e) => setRoomSharing(e.target.value)}
                      className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand"
                    >
                      {ROOM_SHARING_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Remarks / Special Needs (Optional) */}
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                      Remarks / Special Needs (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Need single room, vegetarian meal, ground floor"
                      className="w-full rounded-md border border-surface-border bg-white p-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-brand-ink focus:ring-2 focus:ring-brand"
                    />
                  </div>

                  {/* Submission */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                      disabled={!selectedHostelId || !checkInDate}
                      className="h-11 w-full gap-2 text-sm font-bold shadow-sm"
                    >
                      <Send size={15} />
                      Submit Booking (POST /bookings)
                    </Button>
                    {!user && (
                      <p className="mt-2 text-center text-xs text-amber-700">
                        * Note: POST /bookings requires role user. You will be prompted to sign in.
                      </p>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
