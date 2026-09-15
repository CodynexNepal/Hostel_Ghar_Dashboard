"use client";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AddRoomModal, type NewRoomPayload } from "@/components/rooms/AddRoomModal";
import { MOCK_ROOMS } from "@/lib/mock-data";
import type { Room } from "@/types/hostel";
import type { CreateRoomPayload } from "@/lib/api-types";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useApi, useMutation } from "@/hooks/useApi";
import { hostelGhar, normalizeRoom, toPaginated, unwrap } from "@/lib/hostelGhar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Pencil, Plus } from "lucide-react";

function toCreatePayload(p: NewRoomPayload, hostelId?: string): CreateRoomPayload {
  return {
    roomNumber: p.room.roomNumber,
    floor: p.room.floor,
    type: p.room.type,
    capacity: p.room.capacity,
    monthlyRent: p.room.monthlyRent,
    status: p.room.status,
    amenities: p.amenities,
    ...(hostelId ? { hostelId } : {}),
  };
}

export default function RoomsPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const hostelId = user?.hostelId;
  const [localRooms, setLocalRooms] = useState<Room[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);

  const { data, error, isLoading, retry } = useApi(async () => {
    const res = await hostelGhar.rooms.list({
      limit: 100,
      ...(hostelId ? { hostelId } : {}),
    });
    return toPaginated<unknown>(res.data).items.map(normalizeRoom);
  }, [hostelId]);

  const createMutation = useMutation((payload: CreateRoomPayload, image?: File | null) =>
    hostelGhar.rooms.create(payload, image ?? null)
  );
  const updateMutation = useMutation(
    (id: string, payload: CreateRoomPayload, image?: File | null) =>
      hostelGhar.rooms.update(id, payload, image ?? null)
  );

  const apiRooms = useMemo(() => data ?? [], [data]);
  const rooms = useMemo(() => {
    if (apiRooms.length === 0 && localRooms.length === 0) return error ? MOCK_ROOMS : apiRooms;
    const merged = [...localRooms, ...apiRooms];
    if (merged.length === 0) return MOCK_ROOMS;
    return merged;
  }, [apiRooms, localRooms, error]);
  const usingFallback = Boolean(error);
  const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
  const busy = createMutation.isPending || updateMutation.isPending;

  async function handleSubmitRoom(payload: NewRoomPayload) {
    const duplicate = rooms.some(
      (r) =>
        r.roomNumber.toLowerCase() === payload.room.roomNumber.toLowerCase() &&
        (!editing || r.id !== editing.id)
    );
    if (duplicate) {
      toastError("Room already exists", `Room ${payload.room.roomNumber} is already listed.`);
      return;
    }
    if (editing) {
      const updated = await updateMutation.mutate(
        editing.id,
        toCreatePayload(payload, hostelId),
        payload.imageFile
      );
      if (updated) {
        const saved = normalizeRoom({
          ...(editing as unknown as Record<string, unknown>),
          ...((unwrap(updated) ?? {}) as Record<string, unknown>),
        });
        // Keep the fresh local preview when no new URL came back from the server.
        const imageUrl = saved.imageUrl ?? payload.imagePreviewUrl ?? editing.imageUrl ?? null;
        const merged: Room = { ...saved, ...payload.room, id: editing.id, imageUrl };
        setLocalRooms((prev) =>
          prev.some((r) => r.id === editing.id)
            ? prev.map((r) => (r.id === editing.id ? merged : r))
            : [merged, ...prev]
        );
        // If the row came from the API list, patch it locally too.
        if (apiRooms.some((r) => r.id === editing.id)) {
          setLocalRooms((prev) => {
            const withoutDupes = prev.filter((r) => r.id !== editing.id);
            return [merged, ...withoutDupes];
          });
        }
        setEditing(null);
        setModalOpen(false);
        success("Room updated", `Room ${merged.roomNumber} saved.`);
      } else {
        toastError(
          "Couldn't update room",
          updateMutation.error?.message ?? "Check the fields and try again."
        );
      }
      return;
    }
    const created = await createMutation.mutate(
      toCreatePayload(payload, hostelId),
      payload.imageFile
    );
    if (created) {
      const saved = normalizeRoom(unwrap(created));
      const merged: Room = {
        ...payload.room,
        ...saved,
        imageUrl: saved.imageUrl ?? payload.imagePreviewUrl,
      };
      setLocalRooms((prev) => [merged, ...prev]);
      setModalOpen(false);
      success(
        "Room added",
        `Room ${merged.roomNumber} · ${merged.capacity} beds · ${formatCurrency(merged.monthlyRent)}`
      );
    } else {
      // Offline / API down: keep the UX working with a local row so nothing is lost.
      setLocalRooms((prev) => [payload.room, ...prev]);
      setModalOpen(false);
      toastError(
        "Saved locally — API unreachable",
        createMutation.error?.message ?? "Room kept on this device only."
      );
    }
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(room: Room) {
    setEditing(room);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  const columns: Column<Room>[] = [
    {
      key: "roomNumber",
      header: "Room",
      sortable: true,
      render: (r) => (
        <span className="flex items-center gap-3">
          {r.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.imageUrl}
              alt={`Room ${r.roomNumber}`}
              className="h-10 w-10 shrink-0 rounded-lg border border-surface-border object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs font-bold text-neutral-500">
              {r.roomNumber.slice(0, 3)}
            </span>
          )}
          <span>
            <span className="block font-semibold">Room {r.roomNumber}</span>
            <span className="block text-xs text-neutral-500">
              Floor {r.floor} · {r.type}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "occupied",
      header: "Occupancy",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          {r.occupied} / {r.capacity}
        </span>
      ),
    },
    {
      key: "monthlyRent",
      header: "Rent",
      sortable: true,
      render: (r) => <span className="font-semibold">{formatCurrency(r.monthlyRent)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <span className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit Room ${r.roomNumber}`}
            onClick={() => openEdit(r)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => success("Room opened", `Room ${r.roomNumber}`)}
          >
            Manage
          </Button>
        </span>
      ),
    },
  ];
  return (
    <DashboardShell title="Rooms" subtitle="Hostel Ghar / Hostel / Rooms — occupancy and rent.">
      <Protected permission="MANAGE_ROOMS" redirectTo="/hostel">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {isLoading ? "Loading rooms…" : `${rooms.length} rooms · ${availableCount} available`}
            {usingFallback && !isLoading && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                offline preview
              </span>
            )}
          </p>
          <Button onClick={openCreate} loading={busy}>
            <Plus className="h-4 w-4" /> Add Room
          </Button>
        </div>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : error && rooms.length === 0 ? (
          <ErrorState title="Couldn't load rooms" description={error.message} onRetry={retry} />
        ) : rooms.length === 0 ? (
          <EmptyState
            title="No rooms yet"
            description="Add your first room with floor, type, rent and a photo."
            action={<Button onClick={openCreate}>Add Room</Button>}
          />
        ) : (
          <DataTable<Room>
            columns={columns}
            rows={rooms}
            rowKey={(r) => r.id}
            searchableKeys={["roomNumber", "status", "type"]}
            searchPlaceholder="Search rooms…"
            mobileCard={(r) => (
              <div className="flex items-center gap-3">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.imageUrl}
                    alt={`Room ${r.roomNumber}`}
                    className="h-11 w-11 shrink-0 rounded-lg border border-surface-border object-cover"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Room {r.roomNumber}</span>
                  <span className="block text-xs text-neutral-500">
                    {r.occupied}/{r.capacity} beds · {formatCurrency(r.monthlyRent)}
                  </span>
                </span>
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              </div>
            )}
          />
        )}
        {(createMutation.error || updateMutation.error) && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {(updateMutation.error ?? createMutation.error)?.message}
          </p>
        )}
        <AddRoomModal
          open={modalOpen}
          onClose={closeModal}
          onSubmit={handleSubmitRoom}
          initialRoom={editing}
        />
      </Protected>
    </DashboardShell>
  );
}
