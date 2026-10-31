"use client";
import { useEffect, useRef, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { BackLink } from "@/components/ui/BackLink";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import type { Hostel } from "@/types/hostel";
import { useToast } from "@/hooks/useToast";
import { useApi } from "@/hooks/useApi";
import { hostelGhar, normalizeHostelList, toApiError } from "@/lib/hostelGhar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import {
  Ban,
  CheckCircle2,
  ImagePlus,
  Plus,
  Utensils,
  MapPin,
  ExternalLink,
  Globe,
} from "lucide-react";
import type { WeeklyMealSchedule, HostelLocation } from "@/lib/api-types";
import { unwrap } from "@/lib/hostelGhar";

const EMPTY_FORM = {
  name: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  type: "" as "" | "BOYS" | "GIRLS",
};

export default function AdminHostelsPage() {
  const { success, error: toastError } = useToast();
  const { data, error, isLoading, refetch } = useApi(async () => {
    const res = await hostelGhar.admin.listHostels();
    // The backend sends `rooms` / `beds` / `occupied` and a nested `owner`
    // object; normalizeHostel maps those onto the `Hostel` shape the table
    // renders (otherwise the columns show `undefined`).
    return normalizeHostelList(res.data);
  }, []);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement | null>(null);
  const [statusTarget, setStatusTarget] = useState<Hostel | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [viewTarget, setViewTarget] = useState<Hostel | null>(null);
  const [viewMeals, setViewMeals] = useState<WeeklyMealSchedule | null>(null);
  const [viewLocation, setViewLocation] = useState<HostelLocation | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const handleViewHostel = async (h: Hostel) => {
    setViewTarget(h);
    setIsDetailLoading(true);
    try {
      const [mealsRes, locRes] = await Promise.all([
        hostelGhar.meals.get(h.id).catch(() => null),
        hostelGhar.location.get(h.id).catch(() => null),
      ]);
      setViewMeals(mealsRes ? unwrap<WeeklyMealSchedule>(mealsRes.data) : null);
      setViewLocation(locRes ? unwrap<HostelLocation>(locRes.data) : null);
    } finally {
      setIsDetailLoading(false);
    }
  };
  // Optimistic status overrides — applied instantly on suspend/activate so the
  // badge flips even before (or if) the list refetch returns the new row.
  const [statusOverride, setStatusOverride] = useState<Record<string, Hostel["status"]>>({});
  const hostels = (data ?? []).map((h) =>
    statusOverride[h.id] ? { ...h, status: statusOverride[h.id] } : h
  );

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setLogoFile(null);
    if (logoRef.current) logoRef.current.value = "";
  }

  function pickLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Hostel logo must be an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError("Hostel logo must be under 3 MB.");
      return;
    }
    setFormError(null);
    setLogoFile(file);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.type) {
      setFormError("Please select hostel type (BOYS or GIRLS).");
      return;
    }
    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      type: form.type,
    };
    try {
      setIsCreating(true);
      await hostelGhar.admin.createHostel(payload, logoFile ?? undefined);
      success("Hostel created", form.name);
      setShowCreate(false);
      resetForm();
      refetch();
    } catch (err) {
      const shape = toApiError(err);
      const raw = err as {
        response?: { data?: { errors?: { field?: string; messages?: string[] }[] } };
      };
      const details = raw.response?.data?.errors
        ?.map((item) => `${item.field}: ${(item.messages ?? []).join(", ")}`)
        .join(" · ");
      const message = details ? `${shape.message} — ${details}` : shape.message;
      setFormError(message);
      toastError("Couldn't create hostel", message);
    } finally {
      setIsCreating(false);
    }
  }

  async function confirmStatusChange() {
    if (!statusTarget) return;
    const suspending = statusTarget.status === "ACTIVE";
    const next = suspending ? "SUSPENDED" : "ACTIVE";
    setIsToggling(true);
    try {
      const res = suspending
        ? await hostelGhar.admin.suspendHostel(statusTarget.id)
        : await hostelGhar.admin.activateHostel(statusTarget.id);
      // Trust the backend echo when it carries the hostel (suspend returns the
      // updated row); otherwise fall back to our intended state so the badge
      // flips instantly even if the list refetch is cached/slow.
      let applied: Hostel["status"] = next;
      try {
        const echoed = normalizeHostelList(res?.data);
        const match = echoed.find((h) => h.id === statusTarget.id);
        if (match && (match.status === "ACTIVE" || match.status === "SUSPENDED")) {
          applied = match.status;
        }
      } catch {
        /* keep intended state */
      }
      success(
        applied === "SUSPENDED" ? "Hostel suspended" : "Hostel re-activated",
        `${statusTarget.name} is now ${applied}.`
      );
      setStatusTarget(null);
      // Flip the badge instantly; the refetch below then confirms it.
      setStatusOverride((prev) => ({ ...prev, [statusTarget.id]: applied }));
      try {
        await refetch();
      } catch {
        /* list keeps optimistic badge below — non-fatal */
      }
      void applied;
    } catch (err) {
      toastError("Status change failed", toApiError(err).message);
    } finally {
      setIsToggling(false);
    }
  }

  const columns: Column<Hostel>[] = [
    {
      key: "name",
      header: "Hostel",
      sortable: true,
      render: (hostel) => {
        const logo = hostel.imageUrl || hostel.logoUrl;
        return (
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-xs font-bold text-neutral-500">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt={`${hostel.name} logo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                hostel.name.slice(0, 2).toUpperCase()
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{hostel.name}</span>
              <span className="block truncate text-xs text-neutral-500">{hostel.address}</span>
            </span>
          </span>
        );
      },
    },
    {
      key: "ownerName",
      header: "Owner",
      sortable: true,
      render: (hostel) => {
        const owner = hostel.owner;
        const name = hostel.ownerName ?? "No owner";
        if (!owner) return <span className="text-xs text-neutral-400">No owner assigned</span>;
        return (
          <span className="flex min-w-0 items-center gap-2">
            {owner.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={owner.avatarUrl}
                alt={`${name} avatar`}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <span className="min-w-0">
              <span className="block truncate font-medium">{name}</span>
              <span className="block truncate text-xs text-neutral-500">
                {owner.phone ?? owner.email ?? "—"}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: "occupiedBeds",
      header: "Occupancy",
      sortable: true,
      render: (hostel) => {
        const occupied = hostel.occupiedBeds;
        const total = hostel.totalBeds;
        if (total == null) return <span>{occupied}</span>;
        if (total <= 0) return <span className="text-xs text-neutral-400">No beds</span>;
        const pct = Math.round((occupied / total) * 100);
        // `occupied` can exceed `beds` when the backend counts residents rather
        // than filled beds — the bar width is clamped so it never overflows.
        const tone = pct >= 100 ? "bg-amber-500" : pct >= 75 ? "bg-brand" : "bg-emerald-500";
        return (
          <span className="block min-w-[92px]">
            <span className="flex items-baseline gap-1 text-sm">
              <span className="font-semibold text-neutral-900">{occupied}</span>
              <span className="text-xs text-neutral-500">/ {total} beds</span>
              {occupied > total && (
                <span className="text-[10px] font-semibold uppercase text-amber-700">over</span>
              )}
            </span>
            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <span
                className={`block h-full rounded-full ${tone}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </span>
          </span>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (hostel) =>
        hostel.type ? (
          <Badge tone={hostel.type === "GIRLS" ? "blue" : "gray"}>{hostel.type}</Badge>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (hostel) => <Badge tone={statusTone(hostel.status)}>{hostel.status}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (hostel) => {
        const suspending = hostel.status === "ACTIVE";
        return (
          <span className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => handleViewHostel(hostel)}>
              View
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${suspending ? "Suspend" : "Re-activate"} ${hostel.name}`}
              title={
                suspending
                  ? "Suspend hostel (blocks owner logins)"
                  : hostel.status === "SUSPENDED"
                    ? "Re-activate hostel"
                    : "Activate hostel"
              }
              onClick={() => setStatusTarget(hostel)}
            >
              {suspending ? (
                <Ban className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-700" />
              )}
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <DashboardShell
      title="Hostels"
      subtitle="Hostel Ghar / Admin / Hostels — create, suspend, manage."
    >
      <BackLink href="/admin" label="Platform overview" />
      <div className="mb-4 mt-3 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {isLoading ? "Loading hostels…" : `${hostels.length} hostels`}
        </p>
        <Button onClick={() => setShowCreate((visible) => !visible)}>
          <Plus className="h-4 w-4" /> Create Hostel
        </Button>
      </div>
      {showCreate && (
        <Card className="mb-4 border-brand-ink p-5">
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2" noValidate>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                Hostel logo
              </span>
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-surface-muted">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt="Hostel logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-neutral-400" aria-hidden />
                  )}
                </span>
                <div>
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Upload hostel logo"
                    onChange={pickLogo}
                  />
                  <Button type="button" variant="outline" onClick={() => logoRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Upload logo
                  </Button>
                  <p className="mt-1 text-xs text-neutral-500">Optional, up to 3 MB</p>
                </div>
              </div>
            </div>
            <Input
              label="Name *"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <Input
              label="City *"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              required
            />
            <Input
              label="Address *"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              required
            />
            <Input
              label="Phone *"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              required
            />
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
            <div className="w-full">
              <span className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                Type <span className="ml-0.5 text-red-600">*</span>
              </span>
              <div
                className="flex h-10 items-center gap-2"
                role="radiogroup"
                aria-label="Hostel type"
              >
                {(["BOYS", "GIRLS"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={form.type === type}
                    onClick={() => {
                      setForm({ ...form, type });
                      setFormError(null);
                    }}
                    className={
                      form.type === type
                        ? "rounded-full bg-brand-ink px-4 py-1.5 text-[13px] font-semibold text-brand"
                        : "rounded-full bg-neutral-100 px-4 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-neutral-200"
                    }
                  >
                    {type === "BOYS" ? "Boys" : "Girls"}
                  </button>
                ))}
              </div>
            </div>
            {formError && (
              <p
                role="alert"
                className="rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-700 sm:col-span-2"
              >
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isCreating}>
                Create hostel
              </Button>
            </div>
          </form>
        </Card>
      )}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorState title="Couldn't load hostels" description={error.message} onRetry={refetch} />
      ) : hostels.length === 0 ? (
        <EmptyState
          title="No hostels yet"
          description="Create the first hostel to onboard an owner."
        />
      ) : (
        <DataTable<Hostel>
          columns={columns}
          rows={hostels}
          rowKey={(hostel) => hostel.id}
          searchableKeys={["name", "ownerName", "city"]}
          searchPlaceholder="Search hostels…"
          mobileCard={(hostel) => (
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{hostel.name}</span>
                <span className="block truncate text-xs text-neutral-500">
                  {hostel.address || hostel.city}
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  {hostel.ownerName ?? "No owner"}
                  {hostel.owner?.phone ? ` · ${hostel.owner.phone}` : ""} ·{" "}
                  {hostel.totalBeds != null
                    ? `${hostel.occupiedBeds}/${hostel.totalBeds} beds`
                    : `${hostel.occupiedBeds} beds`}
                </span>
                {hostel.city ? (
                  <span className="block truncate text-xs text-neutral-400">
                    {hostel.city}
                    {hostel.type ? ` · ${hostel.type}` : ""}
                  </span>
                ) : null}
              </span>
              <Badge tone={statusTone(hostel.status)}>{hostel.status}</Badge>
            </div>
          )}
        />
      )}
      <Card className="mt-4 p-4 text-[13px] text-neutral-500">
        Suspending a hostel immediately blocks owner logins and resident payments — backend enforces
        authorization on every request.
      </Card>
      <Modal
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        title={
          statusTarget
            ? statusTarget.status === "ACTIVE"
              ? `Suspend ${statusTarget.name}?`
              : `Re-activate ${statusTarget.name}?`
            : undefined
        }
        description={
          statusTarget
            ? statusTarget.status === "ACTIVE"
              ? "Owner logins and resident payments for this hostel will be blocked immediately."
              : "The hostel returns to ACTIVE and owners can log in again."
            : undefined
        }
      >
        {statusTarget && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <Badge tone={statusTone(statusTarget.status)}>{statusTarget.status}</Badge>
              <span aria-hidden>→</span>
              <Badge tone={statusTarget.status === "ACTIVE" ? "red" : "green"}>
                {statusTarget.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
              </Badge>
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={isToggling}>
                Cancel
              </Button>
              <Button
                variant={statusTarget.status === "ACTIVE" ? "danger" : "primary"}
                onClick={confirmStatusChange}
                loading={isToggling}
              >
                {statusTarget.status === "ACTIVE" ? (
                  <>
                    <Ban className="h-4 w-4" /> Suspend hostel
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Re-activate
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Admin Hostel Overview & Features Modal */}
      <Modal
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        title={viewTarget ? `${viewTarget.name} — Overview & Settings` : "Hostel Overview"}
      >
        {viewTarget && (
          <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-xs">
              <div>
                <span className="block text-[10px] uppercase text-neutral-400">Hostel Type</span>
                <span className="font-semibold text-neutral-800">{viewTarget.type || "N/A"}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-neutral-400">Location</span>
                <span className="font-semibold text-neutral-800">
                  {[viewTarget.address, viewTarget.city].filter(Boolean).join(", ") || "N/A"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-neutral-400">Contact</span>
                <span className="font-semibold text-neutral-800">
                  {viewTarget.phone || viewTarget.email || "N/A"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-neutral-400">Status</span>
                <Badge tone={statusTone(viewTarget.status)}>{viewTarget.status}</Badge>
              </div>
            </div>

            {/* Geographic Location Status */}
            <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-neutral-700" />
                  <h3 className="text-xs font-bold text-neutral-900">
                    Geographic Location Sharing
                  </h3>
                </div>
                {viewLocation?.isLocationShared &&
                viewLocation.latitude &&
                viewLocation.longitude ? (
                  <Badge tone="green" className="text-[10px]">
                    Publicly Shared
                  </Badge>
                ) : viewLocation?.latitude && viewLocation.longitude ? (
                  <Badge tone="gray" className="text-[10px]">
                    Saved (Hidden)
                  </Badge>
                ) : (
                  <Badge tone="amber" className="text-[10px]">
                    Not Configured
                  </Badge>
                )}
              </div>

              {isDetailLoading ? (
                <p className="text-xs text-neutral-400">Loading location data...</p>
              ) : viewLocation?.latitude && viewLocation?.longitude ? (
                <div className="space-y-2">
                  <p className="font-mono text-xs text-neutral-700">
                    Coordinates:{" "}
                    <strong>
                      {viewLocation.latitude}, {viewLocation.longitude}
                    </strong>
                  </p>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${viewLocation.latitude},${viewLocation.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-black inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                  >
                    View on Google Maps <ExternalLink size={12} />
                  </a>
                </div>
              ) : (
                <p className="text-xs italic text-neutral-500">
                  Hostel owner has not configured GPS coordinates yet.
                </p>
              )}
            </div>

            {/* Weekly Meal Schedule Status */}
            <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Utensils size={16} className="text-neutral-700" />
                  <h3 className="text-xs font-bold text-neutral-900">Weekly Meal Schedule</h3>
                </div>
                {viewMeals?.hasSchedule ? (
                  <Badge tone="green" className="text-[10px]">
                    Published
                  </Badge>
                ) : (
                  <Badge tone="gray" className="text-[10px]">
                    Not Configured
                  </Badge>
                )}
              </div>

              {isDetailLoading ? (
                <p className="text-xs text-neutral-400">Loading meals data...</p>
              ) : viewMeals?.hasSchedule ? (
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {(viewMeals.schedule ?? viewMeals.days ?? []).map((day) => {
                    const hasB = Boolean(day.breakfastDescription?.trim());
                    const hasM = Boolean(day.mainMealDescription?.trim());
                    if (!hasB && !hasM) return null;
                    return (
                      <div
                        key={day.dayOfWeek}
                        className="space-y-1 rounded-lg bg-neutral-50 p-2 text-xs"
                      >
                        <span className="font-bold text-neutral-800">{day.dayOfWeek}</span>
                        {hasB && (
                          <p className="text-[11px] text-neutral-600">
                            <strong>Breakfast:</strong> {day.breakfastDescription}
                          </p>
                        )}
                        {hasM && (
                          <p className="text-[11px] text-neutral-600">
                            <strong>Main:</strong> {day.mainMealDescription}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs italic text-neutral-500">
                  Hostel owner has not configured the weekly meal menu yet.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setViewTarget(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
