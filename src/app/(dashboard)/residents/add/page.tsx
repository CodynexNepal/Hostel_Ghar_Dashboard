"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { residentSchema, type ResidentFormValues } from "@/schemas/resident.schema";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@/hooks/useApi";
import { getHostelId } from "@/lib/axios";
import {
  hostelGhar,
  normalizeResident,
  normalizeRoom,
  toPaginated,
  unwrap,
} from "@/lib/hostelGhar";
import type { HostelDetail } from "@/lib/api-types";
import type { Room } from "@/types/hostel";
import type { Resident } from "@/types/resident";
import { MOCK_RESIDENTS, MOCK_ROOMS } from "@/lib/mock-data";

const selectClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";
const labelClass = "mb-1.5 block text-[13px] font-medium text-neutral-800";

/** Resolve hostel id: session → cookie → first hostel. */
async function resolveHostelId(preferred?: string | null): Promise<string | null> {
  if (preferred) return preferred;
  const fromCookie = getHostelId();
  if (fromCookie) return fromCookie;
  try {
    const list = await hostelGhar.hostels.list({ limit: 1 });
    return toPaginated<HostelDetail>(list.data).items[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Bed labels for a room, e.g. capacity 4 → B1..B4, minus occupied beds. */
function bedLabelsForRoom(room: Room, residentsInRoom: Resident[]): string[] {
  const prefix =
    residentsInRoom
      .map(
        (r) =>
          r.bedNumber
            ?.trim()
            .toUpperCase()
            .match(/^([A-Z]+)\d+$/)?.[1]
      )
      .find(Boolean) ?? "B";
  const all = Array.from({ length: Math.max(1, room.capacity) }, (_, i) => `${prefix}${i + 1}`);
  const taken = new Set(residentsInRoom.map((r) => r.bedNumber?.trim().toUpperCase()));
  return all.filter((b) => !taken.has(b));
}

export default function AddResidentPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const {
    mutate,
    isPending,
    error: apiError,
  } = useMutation((payload: Parameters<typeof hostelGhar.owner.createResident>[0]) =>
    hostelGhar.owner.createResident(payload)
  );
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ResidentFormValues>({
    resolver: yupResolver(residentSchema),
    defaultValues: { hostelId: user?.hostelId ?? "", monthlyRent: 12000 },
  });

  const [hostelId, setHostelId] = useState<string | null>(user?.hostelId ?? null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const selectedRoomNumber = watch("roomNumber");
  const selectedBedNumber = watch("bedNumber");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRoomsLoading(true);
      setRoomsError(null);
      const hid = await resolveHostelId(user?.hostelId);
      if (cancelled) return;
      if (hid) {
        setHostelId(hid);
        setValue("hostelId", hid);
      }
      try {
        const roomsRes = await hostelGhar.rooms.list({
          limit: 100,
          ...(hid ? { hostelId: hid } : {}),
        });
        const apiRooms = toPaginated<unknown>(roomsRes.data).items.map(normalizeRoom);
        let apiResidents: Resident[] = [];
        if (hid) {
          try {
            const resRes = await hostelGhar.hostels.residents(hid);
            apiResidents = toPaginated<unknown>(unwrap<unknown>(resRes.data)).items.map(
              normalizeResident
            );
          } catch {
            apiResidents = [];
          }
        }
        if (cancelled) return;
        setRooms(apiRooms.length > 0 ? apiRooms : MOCK_ROOMS);
        setResidents(apiResidents.length > 0 ? apiResidents : MOCK_RESIDENTS);
      } catch {
        if (cancelled) return;
        setRooms(MOCK_ROOMS);
        setResidents(MOCK_RESIDENTS);
        setRoomsError("Couldn't load rooms — showing preview data.");
      } finally {
        if (!cancelled) setRoomsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setValue, user?.hostelId]);

  const selectableRooms = useMemo(
    () =>
      rooms.filter(
        (r) => r.status !== "MAINTENANCE" && r.status !== "FULL" && r.occupied < r.capacity
      ),
    [rooms]
  );
  const fullRooms = useMemo(
    () =>
      rooms.filter(
        (r) => r.status === "FULL" || r.status === "MAINTENANCE" || r.occupied >= r.capacity
      ),
    [rooms]
  );
  const selectedRoom = useMemo(
    () => rooms.find((r) => r.roomNumber === selectedRoomNumber) ?? null,
    [rooms, selectedRoomNumber]
  );
  const residentsInRoom = useMemo(
    () =>
      selectedRoom
        ? residents.filter(
            (r) =>
              r.roomNumber?.trim().toLowerCase() === selectedRoom.roomNumber.trim().toLowerCase()
          )
        : [],
    [residents, selectedRoom]
  );
  const availableBeds = useMemo(
    () => (selectedRoom ? bedLabelsForRoom(selectedRoom, residentsInRoom) : []),
    [selectedRoom, residentsInRoom]
  );

  useEffect(() => {
    if (selectedRoom) setValue("monthlyRent", selectedRoom.monthlyRent, { shouldValidate: true });
  }, [selectedRoom, setValue]);

  useEffect(() => {
    if (!selectedRoom || !selectedBedNumber) return;
    if (!availableBeds.map((b) => b.toUpperCase()).includes(selectedBedNumber.toUpperCase())) {
      setValue("bedNumber", "", { shouldValidate: true });
    }
  }, [availableBeds, selectedBedNumber, selectedRoom, setValue]);

  async function onSubmit(data: ResidentFormValues) {
    const result = await mutate({
      name: data.name,
      email: data.email,
      phone: data.phone,
      hostelId: data.hostelId,
      roomNumber: data.roomNumber,
      bedNumber: data.bedNumber,
      monthlyRent: Number(data.monthlyRent),
    });
    if (result) {
      success("Resident added", `${data.name} · Room ${data.roomNumber} · Bed ${data.bedNumber}`);
      router.push("/residents");
    } else {
      toastError("Couldn't add resident", apiError?.message ?? "Check the fields and try again.");
    }
  }
  return (
    <DashboardShell title="Add Resident" subtitle="Hostel Ghar / Residents / Add Resident">
      <Protected permission="ADD_RESIDENT" redirectTo="/residents">
        <BackLink href="/residents" label="All residents" />
        <Card className="mt-3 p-5 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Input
              label="Hostel ID"
              placeholder="Enter hostel ID"
              error={errors.hostelId?.message}
              {...register("hostelId")}
              required
              readOnly={Boolean(hostelId)}
            />
            <Input
              label="Full name"
              placeholder="Ramesh Adhikari"
              error={errors.name?.message}
              {...register("name")}
              required
            />
            <Input
              label="Phone"
              placeholder="9841000001"
              error={errors.phone?.message}
              {...register("phone")}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="resident@mail.com"
              error={errors.email?.message}
              {...register("email")}
              required
            />
            <div>
              <label htmlFor="roomNumber" className={labelClass}>
                Room number <span className="ml-0.5 text-red-600">*</span>
              </label>
              <select
                id="roomNumber"
                {...register("roomNumber")}
                className={selectClass}
                disabled={roomsLoading || selectableRooms.length === 0}
                required
              >
                <option value="">
                  {roomsLoading
                    ? "Loading rooms…"
                    : selectableRooms.length === 0
                      ? "No rooms available"
                      : "Select a room…"}
                </option>
                {selectableRooms.map((r) => (
                  <option key={r.id} value={r.roomNumber}>
                    Room {r.roomNumber} · {r.type.toLowerCase()} · {r.occupied}/{r.capacity} beds ·
                    Rs. {r.monthlyRent}
                  </option>
                ))}
                {fullRooms.length > 0 && (
                  <optgroup label="Full / unavailable">
                    {fullRooms.map((r) => (
                      <option key={r.id} value={r.roomNumber} disabled>
                        Room {r.roomNumber} · {r.status.toLowerCase()} ({r.occupied}/{r.capacity})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {errors.roomNumber?.message && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {errors.roomNumber.message}
                </p>
              )}
              {!roomsLoading && selectableRooms.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  All rooms are full or under maintenance.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="bedNumber" className={labelClass}>
                Bed number <span className="ml-0.5 text-red-600">*</span>
              </label>
              <select
                id="bedNumber"
                {...register("bedNumber")}
                className={selectClass}
                disabled={!selectedRoom || availableBeds.length === 0}
                required
              >
                <option value="">
                  {!selectedRoom
                    ? "Select a room first…"
                    : availableBeds.length === 0
                      ? "No beds left in this room"
                      : "Select a bed…"}
                </option>
                {availableBeds.map((b) => (
                  <option key={b} value={b}>
                    {b} · Room {selectedRoom?.roomNumber}
                  </option>
                ))}
              </select>
              {errors.bedNumber?.message && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {errors.bedNumber.message}
                </p>
              )}
              {selectedRoom && availableBeds.length > 0 && (
                <p className="mt-1 text-xs text-neutral-500">
                  {availableBeds.length} of {selectedRoom.capacity} bed(s) free.
                </p>
              )}
            </div>
            <div>
              <Input
                label="Monthly rent (Rs.)"
                type="number"
                error={errors.monthlyRent?.message}
                {...register("monthlyRent")}
                required
                readOnly
                className="bg-neutral-50 text-neutral-700"
              />
              <p className="mt-1 text-xs text-neutral-500">
                {selectedRoom
                  ? `Auto-filled from Room ${selectedRoom.roomNumber}.`
                  : "Select a room to auto-fill rent."}
              </p>
            </div>
            {roomsError && (
              <p
                role="status"
                className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800 sm:col-span-2"
              >
                {roomsError}
              </p>
            )}
            {apiError && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700 sm:col-span-2"
              >
                {apiError.message}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending} disabled={roomsLoading}>
                Add Resident
              </Button>
            </div>
          </form>
        </Card>
      </Protected>
    </DashboardShell>
  );
}
