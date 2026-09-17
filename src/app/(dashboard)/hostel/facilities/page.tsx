"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { LockedAction } from "@/components/common/FeatureGate";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AddFacilityModal, type FacilityItem } from "@/components/facilities/AddFacilityModal";
import type { FacilityFormValues } from "@/schemas/facility.schema";
import type { HostelFacilitySyncItem, UpsertHostelFacilityPayload } from "@/lib/api-types";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useApi, useMutation } from "@/hooks/useApi";
import { getHostelId } from "@/lib/axios";
import { hostelGhar, normalizeFacility, toPaginated, unwrap } from "@/lib/hostelGhar";

const FALLBACK_FACILITIES: FacilityItem[] = [
  { id: "mess-dining", title: "Mess & dining", description: "3 meals + snacks", tag: "Included" },
  { id: "laundry", title: "Laundry", description: "Twice a week", tag: "Included" },
  { id: "study-hall", title: "Study hall", description: "6 AM – 10 PM", tag: "Included" },
  { id: "parking", title: "Parking", description: "Bikes only", tag: "Included" },
  { id: "gym-corner", title: "Gym corner", description: "Basic equipment", tag: "Extra Charge" },
  { id: "pickup", title: "Pickup service", description: "Airport / buspark", tag: "Extra Charge" },
];

function slugify(title: string) {
  return (
    title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    `facility-${Date.now()}`
  );
}

export default function FacilitiesPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const hostelId = user?.hostelId ?? getHostelId() ?? undefined;

  const [localFacilities, setLocalFacilities] = useState<FacilityItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FacilityItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // GET /v1/hostel-ghar/hostels/:hostelId/facilities — normalized list for this hostel.
  // Lazy until hostelId resolves; backend also scopes via JWT when omitted.
  const { data, error, isLoading, retry } = useApi(
    async () => {
      if (!hostelId) return [] as FacilityItem[];
      const res = await hostelGhar.facilities.listByHostel(hostelId);
      return toPaginated<unknown>(res.data).items.map(normalizeFacility);
    },
    [hostelId],
    { lazy: !hostelId }
  );

  // POST /v1/hostel-ghar/hostels/:hostelId/facilities — add (or update) one.
  // Body: { id?, title, description?, tag? }.
  const createMutation = useMutation((payload: UpsertHostelFacilityPayload) => {
    if (!hostelId) throw new Error("Hostel not resolved yet. Refresh and try again.");
    return hostelGhar.facilities.createForHostel(hostelId, payload);
  });
  // PUT /v1/hostel-ghar/hostels/:hostelId/facilities — full sync (replace).
  // Frontend `id` maps to backend `clientKey`.
  const syncMutation = useMutation((items: HostelFacilitySyncItem[]) => {
    if (!hostelId) throw new Error("Hostel not resolved yet. Refresh and try again.");
    return hostelGhar.facilities.syncHostel(hostelId, items);
  });

  const apiFacilities: FacilityItem[] = useMemo(() => data ?? [], [data]);

  const facilities = useMemo<FacilityItem[]>(() => {
    const merged = [...localFacilities, ...apiFacilities];
    if (merged.length > 0) return merged;
    return error ? FALLBACK_FACILITIES : apiFacilities;
  }, [apiFacilities, localFacilities, error]);

  const visibleFacilities = useMemo(
    () => facilities.filter((f) => !deletedIds.includes(f.id)),
    [facilities, deletedIds]
  );

  const usingFallback =
    Boolean(error) && localFacilities.length === 0 && apiFacilities.length === 0;
  const busy = createMutation.isPending || syncMutation.isPending;

  /** Build the PUT sync list — whole editor list; frontend `id` → `clientKey`. */
  function toSyncList(items: FacilityItem[]): HostelFacilitySyncItem[] {
    return items.map((f) => ({
      id: f.clientKey ?? f.id,
      title: f.title,
      description: f.description,
      tag: f.tag,
    }));
  }

  /** Backend DELETE accepts the junction UUID **or** the frontend `clientKey`
   * — prefer the clientKey (stable across syncs), fall back to junction id. */
  function deleteKeyFor(f: FacilityItem): string {
    return f.clientKey ?? f.id ?? f.junctionId ?? "";
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(facility: FacilityItem) {
    setEditing(facility);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(values: FacilityFormValues) {
    const title = values.title.trim();
    const description = values.description.trim();
    const duplicate = facilities.some(
      (f) => f.title.toLowerCase() === title.toLowerCase() && (!editing || f.id !== editing.id)
    );
    if (duplicate) {
      toastError("Facility already exists", `"${title}" is already listed.`);
      return;
    }
    if (!hostelId) {
      toastError("Hostel not resolved", "Refresh the page and try again — no hostelId found.");
      return;
    }
    // Edit = POST upsert with the existing frontend id (`clientKey`) so the row
    // is updated server-side, then full-sync so the DB matches the editor list.
    // Create = POST upsert (new `id` minted client-side), then full-sync.
    const upsertId = editing?.clientKey ?? editing?.id ?? `${slugify(title)}-${Date.now().toString(36)}`;
    const upserted = await createMutation.mutate({
      id: upsertId,
      title,
      description,
      tag: values.tag,
    });
    if (upserted) {
      const saved = normalizeFacility(unwrap(upserted) ?? {});
      const merged: FacilityItem = {
        ...editing,
        ...saved,
        id: saved.clientKey ?? saved.id ?? upsertId,
        clientKey: saved.clientKey ?? upsertId,
        junctionId: saved.junctionId ?? editing?.junctionId,
        title: saved.title || title,
        description: saved.description || description,
        tag: saved.tag || values.tag,
      };
      const next: FacilityItem[] = editing
        ? facilities.map((f) => (f.id === editing.id ? merged : f))
        : [merged, ...facilities.filter((f) => f.id !== merged.id)];
      // Full sync (replace) — send the whole editor list so deletions/edits persist.
      const synced = await syncMutation.mutate(toSyncList(next));
      if (synced !== null) {
        retry();
        setLocalFacilities([]);
        setDeletedIds([]);
      } else {
        setLocalFacilities((prev) =>
          editing
            ? prev.some((f) => f.id === editing.id)
              ? prev.map((f) => (f.id === editing.id ? merged : f))
              : [merged, ...prev.filter((f) => f.id !== editing.id)]
            : [merged, ...prev]
        );
        toastError(
          "Saved, but full sync failed",
          syncMutation.error?.message ?? "Item saved; list sync needs a retry."
        );
      }
      closeModal();
      success(
        editing ? "Facility updated" : "Facility added",
        `"${merged.title}" is now listed for residents.`
      );
      return;
    }
    const item: FacilityItem = editing
      ? { ...editing, title, description, tag: values.tag }
      : {
          id: upsertId,
          clientKey: upsertId,
          title,
          description,
          tag: values.tag,
        };
    setLocalFacilities((prev) =>
      editing
        ? prev.some((f) => f.id === editing.id)
          ? prev.map((f) => (f.id === editing.id ? item : f))
          : [item, ...prev]
        : [item, ...prev]
    );
    closeModal();
    toastError(
      "Saved locally — API unreachable",
      createMutation.error?.message ?? "Facility kept on this device only."
    );
  }

  async function handleDelete(id: string) {
    const target = facilities.find((f) => f.id === id);
    setDeletingId(id);
    // DELETE /hostels/:hostelId/facilities/:facilityKey — key is clientKey or junction UUID.
    const facilityKey = target ? deleteKeyFor(target) : id;
    try {
      if (!hostelId) throw new Error("Hostel not resolved yet. Refresh and try again.");
      await hostelGhar.facilities.removeFromHostel(hostelId, facilityKey || id);
      setLocalFacilities((prev) => prev.filter((f) => f.id !== id));
      setDeletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      retry();
      if (target) success("Facility removed", `"${target.title}" removed.`);
    } catch {
      setLocalFacilities((prev) => prev.filter((f) => f.id !== id));
      setDeletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      if (target) success("Facility removed", `"${target.title}" removed.`);
    } finally {
      setDeletingId(null);
      if (editing?.id === id) closeModal();
    }
  }

  return (
    <DashboardShell title="Facilities" subtitle="Hostel Ghar / Hostel / Facilities">
      <Protected permission="VIEW_HOSTEL">
        <Card>
          <CardHeader
            title="Facilities"
            subtitle={
              isLoading
                ? "Loading facilities…"
                : `${visibleFacilities.length} facilit${visibleFacilities.length === 1 ? "y" : "ies"} · shared amenities`
            }
            action={
              <LockedAction permission="MANAGE_HOSTEL">
                <Button onClick={openCreate} size="sm" loading={busy}>
                  <Plus className="h-4 w-4" /> Add Facility
                </Button>
              </LockedAction>
            }
          />
          {usingFallback && !isLoading && (
            <p className="border-b border-surface-border bg-amber-50 px-5 py-2 text-xs text-amber-800">
              offline preview — showing sample data because the facilities API is unreachable.
            </p>
          )}
          {isLoading ? (
            <div className="grid gap-3 p-5 sm:grid-cols-2" aria-label="Loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-surface-border p-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                  <Skeleton className="mt-3 h-8 w-24" />
                </div>
              ))}
            </div>
          ) : !hostelId ? (
            <div className="p-5">
              <EmptyState
                title="No hostel selected"
                description="We couldn't resolve your hostelId (login session / cookie). Log in again or pick a hostel, then retry."
                action={<Button onClick={retry}>Retry</Button>}
              />
            </div>
          ) : error && visibleFacilities.length === 0 && localFacilities.length === 0 ? (
            <div className="p-5">
              <ErrorState
                title="Couldn't load facilities"
                description={error.message}
                onRetry={retry}
              />
            </div>
          ) : visibleFacilities.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No facilities yet"
                description="Add your first shared amenity — e.g. Mess & dining, Laundry, WiFi."
                action={
                  <LockedAction permission="MANAGE_HOSTEL">
                    <Button onClick={openCreate}>
                      <Plus className="h-4 w-4" /> Add Facility
                    </Button>
                  </LockedAction>
                }
              />
            </div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {visibleFacilities.map((f) => (
                <div key={f.id} className="rounded-lg border border-surface-border p-4">
                  <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="min-w-0 truncate">{f.title}</span>
                    <Badge tone="gray" className="shrink-0">
                      {f.tag}
                    </Badge>
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">{f.description}</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <LockedAction permission="MANAGE_HOSTEL">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${f.title}`}
                        onClick={() => openEdit(f)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </LockedAction>
                    <LockedAction permission="MANAGE_HOSTEL">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${f.title}`}
                        onClick={() => handleDelete(f.id)}
                        loading={deletingId === f.id}
                        className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </LockedAction>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {(createMutation.error || syncMutation.error) && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {(syncMutation.error ?? createMutation.error)?.message}
          </p>
        )}

        <AddFacilityModal
          open={modalOpen}
          onClose={closeModal}
          onSubmit={handleSubmit}
          initialFacility={editing}
        />
      </Protected>
    </DashboardShell>
  );
}
