"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useApi, useMutation } from "@/hooks/useApi";
import { hostelGhar, noCacheParams, normalizeRoom, toPaginated, unwrap } from "@/lib/hostelGhar";
import { getHostelId } from "@/lib/axios";
import type { Bed, BedStatus } from "@/lib/api-types";
import type { Room } from "@/types/hostel";
import { Plus } from "lucide-react";

interface BedRow {
  id: string;
  roomNumber: string;
  bedNumber: string;
  roomType: string;
  residentName: string;
  monthlyRent: number;
  status: BedStatus;
}

const INITIAL_BEDS: BedRow[] = [
  { id: "bed-1", roomNumber: "A-101", bedNumber: "B1", roomType: "DOUBLE", residentName: "Aashish Shah", monthlyRent: 9000, status: "OCCUPIED" },
  { id: "bed-2", roomNumber: "A-101", bedNumber: "B2", roomType: "DOUBLE", residentName: "Suman Gurung", monthlyRent: 9000, status: "OCCUPIED" },
  { id: "bed-3", roomNumber: "A-102", bedNumber: "C1", roomType: "DOUBLE", residentName: "Available", monthlyRent: 9500, status: "AVAILABLE" },
  { id: "bed-4", roomNumber: "A-102", bedNumber: "C2", roomType: "DOUBLE", residentName: "Under repair", monthlyRent: 9500, status: "MAINTENANCE" },
];

function normalizeBed(raw: Bed, roomRentFallback?: number, roomTypeFallback?: string): BedRow {
  const rentCandidates = [raw.monthlyFee, raw.monthlyRent, raw.rentAmount, roomRentFallback]
    .map((value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value): value is number => value !== null);

  const monthlyRent = rentCandidates.length > 0 ? Math.max(...rentCandidates.filter((x) => x > 0), 0) : 0;
  const roomType = String(raw.type ?? raw.roomType ?? roomTypeFallback ?? "DOUBLE").toUpperCase();

  return {
    id: raw.id,
    roomNumber: raw.roomNumber ?? "—",
    bedNumber: raw.bedNumber ?? "—",
    roomType,
    residentName: raw.residentName ?? "Available",
    monthlyRent,
    status: raw.status ?? "AVAILABLE",
  };
}

export default function BedsPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const hostelId = user?.hostelId ?? getHostelId();
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("");
  const [localBeds, setLocalBeds] = useState<BedRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    flat: "",
    roomNumber: "",
    bedNumber: "",
    monthlyRent: "",
    status: "AVAILABLE" as BedStatus,
  });

  const { data: roomOptionsData } = useApi(async () => {
    const res = await hostelGhar.rooms.list(noCacheParams({ limit: 100 }));
    return toPaginated<unknown>(res.data).items.map(normalizeRoom);
  }, []);
  const roomMetaByNumber = useMemo(
    () =>
      Object.fromEntries(
        (roomOptionsData ?? []).map((room) => [
          room.roomNumber,
          {
            monthlyRent: Number(room.monthlyRent) || 0,
            roomType: String(room.type ?? "DOUBLE").toUpperCase(),
          },
        ])
      ),
    [roomOptionsData]
  );

  const { data: bedsApi, error, isLoading, retry } = useApi(async () => {
    if (!hostelId) return INITIAL_BEDS;
    const res = await hostelGhar.beds.list({
      hostelId,
      ...(selectedRoomNumber ? { roomNumber: selectedRoomNumber } : {}),
    });
    const rows = toPaginated<Bed>(res.data).items.map((bed) => {
      const roomMeta = roomMetaByNumber[bed.roomNumber ?? ""] ?? {
        monthlyRent: 0,
        roomType: "DOUBLE",
      };
      return normalizeBed(bed, roomMeta.monthlyRent, roomMeta.roomType);
    });
    return rows.length ? rows : INITIAL_BEDS;
  }, [hostelId, selectedRoomNumber, roomMetaByNumber]);

  const { mutate: updateBed, isPending: isUpdating } = useMutation(
    (id: string, status: BedStatus) => hostelGhar.beds.update(id, { status })
  );
  const { mutate: createBed, isPending: isCreating } = useMutation(
    (payload: Parameters<typeof hostelGhar.beds.create>[0]) => hostelGhar.beds.create(payload)
  );

  const beds = useMemo(() => {
    const apiRows = (bedsApi ?? INITIAL_BEDS).map((bed) => {
      const roomMeta = roomMetaByNumber[bed.roomNumber] ?? { monthlyRent: 0, roomType: "DOUBLE" };
      const rent = bed.monthlyRent > 0 ? bed.monthlyRent : roomMeta.monthlyRent;
      return {
        ...bed,
        roomType: String(bed.roomType ?? roomMeta.roomType ?? "DOUBLE").toUpperCase(),
        monthlyRent: rent,
      };
    });
    return [...localBeds, ...apiRows];
  }, [bedsApi, localBeds, roomMetaByNumber]);
  const roomOptions = useMemo(() => roomOptionsData ?? [], [roomOptionsData]);
  const flatOptions = useMemo(
    () =>
      Array.from(new Set(roomOptions.map((room) => room.floor)))
        .filter((floor) => Number.isFinite(floor))
        .sort((a, b) => a - b),
    [roomOptions]
  );
  const filteredRoomOptions = useMemo(
    () =>
      form.flat === ""
        ? roomOptions
        : roomOptions.filter((room) => String(room.floor) === form.flat),
    [form.flat, roomOptions]
  );
  const totals = useMemo(() => {
    const occupied = beds.filter((b) => b.status === "OCCUPIED").length;
    const available = beds.filter((b) => b.status === "AVAILABLE").length;
    const maintenance = beds.filter((b) => b.status === "MAINTENANCE").length;
    return { occupied, available, maintenance };
  }, [beds]);

  async function handleStatusChange(id: string, status: BedStatus) {
    const result = await updateBed(id, status);
    if (result) {
      success("Bed status updated", `${status}`);
      retry();
      return;
    }
    toastError("Couldn't update bed status", "Please try again in a moment.");
  }

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const selectedRoom = roomOptionsData?.find((room) => room.roomNumber === form.roomNumber);
    const roomNumber = (selectedRoom?.roomNumber ?? form.roomNumber).trim();
    const bedNumber = form.bedNumber.trim();
    if (!hostelId || !roomNumber || !bedNumber) {
      toastError("Couldn't add bed", "Select a room and enter a bed number.");
      return;
    }

    const result = await createBed({
      hostelId,
      roomNumber,
      bedNumber,
      status: form.status,
      rentAmount: Number(form.monthlyRent) || undefined,
    });

    if (!result) {
      toastError("Couldn't add bed", "Check the room and bed number, then try again.");
      return;
    }

    const saved = unwrap<Bed>(result);
    const nextRow = normalizeBed(
      {
        ...saved,
        roomNumber: saved.roomNumber ?? roomNumber,
        bedNumber: saved.bedNumber ?? bedNumber,
        monthlyRent: saved.monthlyRent ?? saved.rentAmount ?? (Number(form.monthlyRent) || 0),
        status: saved.status ?? form.status,
      },
      Number(form.monthlyRent) || 0,
      roomOptionsData?.find((room) => room.roomNumber === roomNumber)?.type ?? "DOUBLE"
    );

    setLocalBeds((prev) => [nextRow, ...prev]);
    setForm({
      flat: "",
      roomNumber: "",
      bedNumber: "",
      monthlyRent: "",
      status: "AVAILABLE",
    });
    setOpen(false);
    success("Bed added", `${roomNumber} - ${bedNumber}`);
    retry();
  }

  const columns: Column<BedRow>[] = [
    {
      key: "roomNumber",
      header: "Room",
      sortable: true,
      render: (b) => <span className="font-semibold">{b.roomNumber}</span>,
    },
    {
      key: "bedNumber",
      header: "Bed",
      sortable: true,
      render: (b) => <span>{b.bedNumber}</span>,
    },
    {
      key: "roomType",
      header: "Type",
      sortable: true,
      render: (b) => <span>{b.roomType}</span>,
    },
    {
      key: "residentName",
      header: "Resident",
      sortable: true,
      render: (b) => <span className="text-neutral-700">{b.residentName}</span>,
    },
    {
      key: "monthlyRent",
      header: "Rent",
      sortable: true,
      render: (b) => <span>{formatCurrency(b.monthlyRent)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (b) => (
        <select
          value={b.status}
          onChange={(e) => void handleStatusChange(b.id, e.target.value as BedStatus)}
          disabled={isUpdating}
          className="h-9 rounded-md border border-surface-border bg-white px-2 text-xs font-medium text-neutral-700 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="RESERVED">Reserved</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
      ),
    },
  ];

  return (
    <DashboardShell title="Beds" subtitle="Hostel Ghar / Hostel / Beds — room inventory and bed availability.">
      <Protected permission="MANAGE_ROOMS" redirectTo="/dashboard">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedRoomNumber("")}>
              All rooms
            </Button>
            <Input
              value={selectedRoomNumber}
              onChange={(e) => setSelectedRoomNumber(e.target.value)}
              placeholder="Filter by room number"
              className="w-52"
            />
          </div>
          <Button onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" /> Add Bed
          </Button>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Occupied", totals.occupied, "allocated beds"],
            ["Available", totals.available, "vacant beds"],
            ["Maintenance", totals.maintenance, "needs repair"],
          ].map(([label, value, hint]) => (
            <Card key={label} className="p-4">
              <p className="text-[13px] text-neutral-500">{label}</p>
              <p className="mt-1 text-xl font-bold">{String(value)}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>
            </Card>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Couldn&apos;t load beds from the server. Showing the cached list. <button className="font-semibold underline" onClick={() => void retry()}>Retry</button>
          </div>
        )}

        {isLoading && (
          <div className="mb-4 rounded-md border border-surface-border bg-white p-4 text-sm text-neutral-500">
            Loading beds…
          </div>
        )}

        {open && (
          <Card className="mb-4 p-5">
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-6" noValidate>
              <div>
                <label htmlFor="flat-select" className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                  Flat
                </label>
                <select
                  id="flat-select"
                  value={form.flat}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      flat: e.target.value,
                      roomNumber: "",
                      monthlyRent: "",
                    }))
                  }
                  className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">All flats</option>
                  {flatOptions.map((flat) => (
                    <option key={flat} value={String(flat)}>
                      Flat {flat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="room-select" className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                  Select room <span className="text-red-600">*</span>
                </label>
                <select
                  id="room-select"
                  value={form.roomNumber}
                  onChange={(e) => {
                    const selected = roomOptions.find((room) => room.roomNumber === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      flat: selected ? String(selected.floor) : prev.flat,
                      roomNumber: selected?.roomNumber ?? e.target.value,
                      monthlyRent:
                        selected?.monthlyRent && selected.monthlyRent > 0
                          ? String(selected.monthlyRent)
                          : prev.monthlyRent,
                    }));
                  }}
                  className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">
                    {filteredRoomOptions.length === 0 ? "No rooms found" : "Select room"}
                  </option>
                  {filteredRoomOptions.map((room) => (
                    <option key={room.id} value={room.roomNumber}>
                      {room.roomNumber} · {room.occupied}/{room.capacity} beds · {formatCurrency(room.monthlyRent)}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Bed"
                placeholder="B2"
                value={form.bedNumber}
                onChange={(e) => handleChange("bedNumber", e.target.value)}
                required
              />
              <Input
                label="Rent"
                type="number"
                placeholder="10500"
                value={form.monthlyRent}
                onChange={(e) => handleChange("monthlyRent", e.target.value)}
              />
              <div>
                <label htmlFor="bed-status" className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                  Status
                </label>
                <select
                  id="bed-status"
                  value={form.status}
                  onChange={(e) => handleChange("status", e.target.value as BedStatus)}
                  className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="OCCUPIED">Occupied</option>
                  <option value="RESERVED">Reserved</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              <div className="flex items-end justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isCreating}>Save Bed</Button>
              </div>
            </form>
          </Card>
        )}

        <DataTable<BedRow>
          columns={columns}
          rows={beds}
          rowKey={(row) => row.id}
          searchableKeys={["roomNumber", "bedNumber", "roomType", "residentName"]}
          searchPlaceholder="Search beds…"
          mobileCard={(b) => (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{b.roomNumber} · {b.bedNumber}</p>
                <p className="text-xs text-neutral-500">{b.residentName}</p>
              </div>
              <Badge tone={statusTone(b.status)}>{b.status}</Badge>
            </div>
          )}
        />
      </Protected>
    </DashboardShell>
  );
}
