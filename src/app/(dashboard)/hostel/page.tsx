"use client";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  Wifi,
  Droplets,
  Zap,
  ShieldCheck,
  Utensils,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import {
  hostelGhar,
  normalizeOwnerDashboard,
  toPaginated,
  unwrap,
  validHostelId,
} from "@/lib/hostelGhar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import type { HostelDetail, OwnerDashboard } from "@/lib/api-types";

const FACILITIES = [
  { icon: Wifi, label: "High-speed WiFi", desc: "Fibre on every floor" },
  { icon: Droplets, label: "Hot water", desc: "Solar + backup" },
  { icon: Zap, label: "Power backup", desc: "Inverter + generator" },
  { icon: ShieldCheck, label: "CCTV & warden", desc: "24/7 security" },
];

export default function HostelOverviewPage() {
  const { user, refreshSubscription } = useAuth();
  const { data, error, isLoading, retry } = useApi(async () => {
    // 1) Owner dashboard first — it always knows the hostel (data[0].hostelId)
    //    even when /auth/me never sent a hostelId.
    let dashboard: OwnerDashboard | null = null;
    try {
      const res = await hostelGhar.owner.dashboard();
      // The owner dashboard response keeps summary metrics beside `data`.
      // Normalize the full envelope so the overview receives those values.
      dashboard = normalizeOwnerDashboard(res.data);
    } catch {
      // The hostel profile can still render if the summary endpoint is unavailable.
    }
    const dashHostels = Array.isArray(dashboard?.hostels) ? dashboard!.hostels! : [];
    const dashHostelId = dashHostels[0]?.hostelId;

    // 2) Resolve a detail id: user.hostelId (UUID only) → dashboard row → list.
    //    Non-UUID junk like "h-1" (legacy cache) must NEVER hit GET /hostels/:id.
    let hostel: HostelDetail | null = null;
    const directId = validHostelId(user?.hostelId) ?? validHostelId(dashHostelId);
    if (directId) {
      try {
        const res = await hostelGhar.hostels.get(directId);
        hostel = unwrap<HostelDetail>(res.data);
      } catch {
        hostel = null;
      }
    }
    if (!hostel) {
      try {
        const list = await hostelGhar.hostels.list({ limit: 1 });
        const items = toPaginated<HostelDetail>(list.data).items;
        hostel = items[0] ?? null;
      } catch {
        hostel = null;
      }
    }
    // 3) Last resort: synthesize a card from the dashboard row so a PRO owner
    //    with live dashboard data never sees "No hostel found".
    if (!hostel && dashHostels[0]) {
      const row = dashHostels[0];
      hostel = {
        id: row.hostelId,
        name: row.hostelName ?? user?.hostelName ?? "Your hostel",
        type: row.hostelType,
        address: "",
        city: "",
        phone: "",
        email: user?.email ?? "",
        totalRooms: 0,
        totalBeds: null,
        occupiedBeds: 0,
        status: "ACTIVE",
        ownerName: user?.name ?? null,
      } as HostelDetail;
    }

    return hostel ? { hostel, dashboard } : null;
  }, [user?.hostelId]);

  const hostel = data?.hostel;
  const dashboard = data?.dashboard;
  const rooms = hostel?.rooms ?? [];
  const totalRooms = dashboard?.totalRooms ?? hostel?.totalRooms ?? rooms.length;
  const totalBeds =
    dashboard?.totalBeds ??
    hostel?.totalBeds ??
    rooms.reduce((sum, room) => sum + (room.capacity ?? 0), 0);
  const occupiedBeds =
    dashboard?.occupiedBeds ??
    hostel?.occupiedBeds ??
    rooms.reduce((sum, room) => sum + (room.occupied ?? 0), 0);
  const ownerName = hostel?.owner
    ? `${hostel.owner.firstName} ${hostel.owner.lastName}`.trim()
    : hostel?.ownerName || "Hostel owner";
  const ownerInitials = ownerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DashboardShell
      title="Hostel Overview"
      subtitle="Hostel Ghar / Hostel — profile, contact, meals and location."
    >
      <Protected permission="VIEW_HOSTEL">
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : error ? (
          <ErrorState title="Couldn't load hostel" description={error.message} onRetry={retry} />
        ) : !hostel ? (
          <EmptyState
            title="No hostel found"
            description="Your account is not linked to a hostel yet."
          />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="p-5 sm:p-6 lg:col-span-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-lg font-bold text-neutral-500">
                      {hostel.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={hostel.logoUrl}
                          alt={`${hostel.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        hostel.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2">
                        <span className="truncate text-xl font-bold text-neutral-900">
                          {hostel.name}
                        </span>
                        <Badge tone="green">{hostel.status}</Badge>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                        <MapPin className="h-4 w-4" /> {hostel.address || "Address not set"}
                      </p>
                      <p className="mt-2 flex flex-wrap gap-3 text-[13px] text-neutral-600">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {hostel.phone || "No phone"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" /> {hostel.email || "No email"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:pl-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-sm font-bold text-white">
                      {hostel.owner?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={hostel.owner.avatarUrl}
                          alt={`${ownerName} avatar`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        ownerInitials
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-500">Owner</p>
                      <p className="truncate text-sm font-semibold text-neutral-900">{ownerName}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  {[
                    [String(totalRooms), "Rooms"],
                    [String(totalBeds), "Beds"],
                    [String(occupiedBeds), "Occupied"],
                  ].map(([v, l]) => (
                    <div key={l} className="rounded-lg bg-surface-muted p-3">
                      <p className="text-xl font-bold">{v}</p>
                      <p className="text-xs text-neutral-500">{l}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Facilities" subtitle="What residents get" />
                <ul className="space-y-3 p-5">
                  {FACILITIES.map((f) => (
                    <li key={f.label} className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand">
                        <f.icon className="h-4 w-4 text-brand-ink" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{f.label}</span>
                        <span className="block text-xs text-neutral-500">{f.desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* Quick Profile Management Cards */}
            <div>
              <div className="mb-3">
                <h2 className="text-base font-bold text-neutral-900">Hostel Profile Settings</h2>
                <p className="text-xs text-neutral-500">
                  Manage your public menu, location coordinates, and amenities.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Link
                  href="/hostel/meals"
                  className="shadow-xs group flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-900 hover:shadow-sm"
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-amber-700 transition-transform group-hover:scale-105">
                        <Utensils className="h-5 w-5" />
                      </span>
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-neutral-500 group-hover:text-neutral-900">
                        Manage <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <h3 className="mb-1 text-sm font-bold text-neutral-900">
                      Weekly Meals &amp; Menu
                    </h3>
                    <p className="text-xs leading-relaxed text-neutral-500">
                      Configure 7-day breakfast &amp; main meal routine (Sunday through Saturday)
                      for your hostel.
                    </p>
                  </div>
                </Link>

                <Link
                  href="/hostel/location"
                  className="shadow-xs group flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-900 hover:shadow-sm"
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-700 transition-transform group-hover:scale-105">
                        <MapPin className="h-5 w-5" />
                      </span>
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-neutral-500 group-hover:text-neutral-900">
                        Manage <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <h3 className="mb-1 text-sm font-bold text-neutral-900">Location &amp; Map</h3>
                    <p className="text-xs leading-relaxed text-neutral-500">
                      Set precise GPS coordinates and toggle public map visibility with directions.
                    </p>
                  </div>
                </Link>

                <Link
                  href="/hostel/facilities"
                  className="shadow-xs group flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-900 hover:shadow-sm"
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="bg-brand-lime/30 text-brand-black border-brand-lime/50 rounded-xl border p-2.5 transition-transform group-hover:scale-105">
                        <Sparkles className="h-5 w-5" />
                      </span>
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-neutral-500 group-hover:text-neutral-900">
                        Manage <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <h3 className="mb-1 text-sm font-bold text-neutral-900">
                      Amenities &amp; Facilities
                    </h3>
                    <p className="text-xs leading-relaxed text-neutral-500">
                      Manage hostel amenities, rules, room inclusions, and comfort highlights.
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </Protected>
    </DashboardShell>
  );
}
