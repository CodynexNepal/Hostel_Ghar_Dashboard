"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { toApiError } from "@/lib/axios";
import { hostelGhar, unwrap, toPaginated, normalizeRoom } from "@/lib/hostelGhar";
import type { OwnerRoomOption } from "@/lib/api-types";
import type { Room } from "@/types/hostel";
import type { Resident } from "@/types/resident";
import { editResidentSchema, type EditResidentFormValues } from "@/schemas/resident.schema";

const selectClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";
const labelClass = "mb-1.5 block text-[13px] font-medium text-neutral-800";

interface EditResidentModalProps {
  open: boolean;
  onClose: () => void;
  resident: Resident | null;
  hostelId?: string | null;
  onSuccess: () => void;
}

export function EditResidentModal({
  open,
  onClose,
  resident,
  hostelId,
  onSuccess,
}: EditResidentModalProps) {
  const { success, error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Dynamic room options
  const [rooms, setRooms] = useState<Room[]>([]);
  const [formRooms, setFormRooms] = useState<OwnerRoomOption[] | null>(null);
  const [roomDetail, setRoomDetail] = useState<OwnerRoomOption | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditResidentFormValues>({
    resolver: yupResolver(editResidentSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      roomNumber: "",
      bedNumber: "",
      monthlyRent: undefined,
      status: "ACTIVE",
      paymentStatus: "PAID",
    },
  });

  const selectedRoomNumber = watch("roomNumber");
  const selectedBedNumber = watch("bedNumber");

  // Reset form whenever resident changes
  useEffect(() => {
    if (resident && open) {
      reset({
        name: resident.name ?? "",
        email: resident.email ?? "",
        phone: resident.phone ?? "",
        roomNumber: resident.roomNumber ?? "",
        bedNumber: resident.bedNumber ?? "",
        monthlyRent: resident.monthlyRent ? Number(resident.monthlyRent) : undefined,
        status: resident.status ?? "ACTIVE",
        paymentStatus: resident.paymentStatus ?? "PAID",
      });
      setServerError(null);
    }
  }, [resident, open, reset]);

  // Load rooms for dynamic selection when modal is opened
  useEffect(() => {
    let cancelled = false;
    if (!open || !hostelId) {
      setRooms([]);
      setFormRooms(null);
      return;
    }

    (async () => {
      setRoomsLoading(true);
      try {
        // Try dynamic form-options rooms first
        try {
          const drooms = await hostelGhar.owner.residentFormRooms(hostelId);
          if (!cancelled) {
            setFormRooms(toPaginated<OwnerRoomOption>(unwrap<unknown>(drooms.data)).items);
          }
        } catch {
          if (!cancelled) setFormRooms(null);
        }

        // Also fetch room inventory list as fallback
        const roomsRes = await hostelGhar.rooms.list({ limit: 100, hostelId });
        if (!cancelled) {
          const apiRooms = toPaginated<unknown>(roomsRes.data).items.map(normalizeRoom);
          setRooms(apiRooms);
        }
      } catch {
        if (!cancelled) {
          setRooms([]);
          setFormRooms(null);
        }
      } finally {
        if (!cancelled) setRoomsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, hostelId]);

  // Fetch bed options when selected room changes
  useEffect(() => {
    let cancelled = false;
    if (!open || !hostelId || !selectedRoomNumber) {
      setRoomDetail(null);
      return;
    }

    (async () => {
      try {
        const res = await hostelGhar.owner.residentFormRoomDetail(hostelId, selectedRoomNumber);
        const detail = unwrap<OwnerRoomOption>(res.data);
        if (cancelled) return;
        setRoomDetail(detail);

        // If user changed to a new room, auto-suggest rent if room rent exists
        if (resident && selectedRoomNumber !== resident.roomNumber) {
          const rent = Number((detail as { monthlyRent?: unknown }).monthlyRent);
          if (Number.isFinite(rent) && rent > 0) {
            setValue("monthlyRent", rent, { shouldValidate: true });
          }
        }
      } catch {
        if (!cancelled) setRoomDetail(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, hostelId, selectedRoomNumber, resident, setValue]);

  // Available beds calculation
  const availableBeds = useMemo(() => {
    const beds = new Set<string>();

    // Always include current resident's bed if same room
    if (resident && resident.roomNumber === selectedRoomNumber && resident.bedNumber) {
      beds.add(resident.bedNumber);
    }

    // Dynamic beds from roomDetail
    if (roomDetail?.beds) {
      for (const b of roomDetail.beds) {
        if (!b.disabled && (!b.taken || b.value === resident?.bedNumber)) {
          beds.add(b.value);
        }
      }
    }

    // From formRooms
    const selectedFormRoom = formRooms?.find((r) => r.roomNumber === selectedRoomNumber);
    if (selectedFormRoom?.beds) {
      for (const b of selectedFormRoom.beds) {
        if (!b.disabled && (!b.taken || b.value === resident?.bedNumber)) {
          beds.add(b.value);
        }
      }
    }

    // From room inventory
    const selectedInvRoom = rooms.find((r) => r.roomNumber === selectedRoomNumber);
    if (selectedInvRoom) {
      for (let i = 1; i <= Math.max(1, selectedInvRoom.capacity); i++) {
        beds.add(`B${i}`);
      }
    }

    // Always include currently selected bed
    if (selectedBedNumber) {
      beds.add(selectedBedNumber);
    }

    return Array.from(beds).sort();
  }, [resident, selectedRoomNumber, roomDetail, formRooms, rooms, selectedBedNumber]);

  async function onSubmit(values: EditResidentFormValues) {
    if (!resident) return;
    setSubmitting(true);
    setServerError(null);

    try {
      await hostelGhar.owner.updateResident(resident.id, {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        roomNumber: values.roomNumber.trim(),
        bedNumber: values.bedNumber.trim(),
        monthlyRent: values.monthlyRent ? Number(values.monthlyRent) : undefined,
        status: values.status as Resident["status"],
        paymentStatus: values.paymentStatus as Resident["paymentStatus"],
        ...(hostelId ? { hostelId } : {}),
      });

      success("Resident updated", `${values.name} has been updated.`);
      onSuccess();
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      const msg = apiErr.message || "Failed to update resident. Please try again.";
      setServerError(msg);
      toastError("Update failed", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !resident) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Resident"
      description={`Update profile and room details for ${resident.name}.`}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1" noValidate>
        {serverError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            {serverError}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Full Name */}
          <div className="sm:col-span-2">
            <Input
              label="Full name"
              placeholder="Full Name"
              error={errors.name?.message}
              {...register("name")}
              required
            />
          </div>

          {/* Phone */}
          <Input
            label="Phone number"
            placeholder="9841000000"
            error={errors.phone?.message}
            {...register("phone")}
            required
          />

          {/* Email */}
          <Input
            label="Email address"
            type="email"
            placeholder="resident@example.com"
            error={errors.email?.message}
            {...register("email")}
            required
          />

          {/* Room Selection */}
          <div>
            <label htmlFor="edit-roomNumber" className={labelClass}>
              Room number <span className="ml-0.5 text-red-600">*</span>
            </label>
            {formRooms && formRooms.length > 0 ? (
              <select
                id="edit-roomNumber"
                {...register("roomNumber")}
                className={selectClass}
                disabled={roomsLoading || submitting}
                required
              >
                {/* Ensure current resident room exists as an option */}
                {!formRooms.some((r) => r.roomNumber === resident.roomNumber) && (
                  <option value={resident.roomNumber}>Room {resident.roomNumber} (Current)</option>
                )}
                {formRooms.map((r) => (
                  <option
                    key={r.id}
                    value={r.roomNumber}
                    disabled={r.disabled && r.roomNumber !== resident.roomNumber}
                  >
                    {r.label}
                  </option>
                ))}
              </select>
            ) : rooms.length > 0 ? (
              <select
                id="edit-roomNumber"
                {...register("roomNumber")}
                className={selectClass}
                disabled={roomsLoading || submitting}
                required
              >
                {!rooms.some((r) => r.roomNumber === resident.roomNumber) && (
                  <option value={resident.roomNumber}>Room {resident.roomNumber} (Current)</option>
                )}
                {rooms.map((r) => (
                  <option key={r.id} value={r.roomNumber}>
                    Room {r.roomNumber} · {r.type.toLowerCase()} · Rs. {r.monthlyRent}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="edit-roomNumber"
                placeholder="e.g. 101"
                error={errors.roomNumber?.message}
                {...register("roomNumber")}
                required
              />
            )}
            {errors.roomNumber?.message && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.roomNumber.message}
              </p>
            )}
          </div>

          {/* Bed Selection */}
          <div>
            <label htmlFor="edit-bedNumber" className={labelClass}>
              Bed number <span className="ml-0.5 text-red-600">*</span>
            </label>
            {availableBeds.length > 0 ? (
              <select
                id="edit-bedNumber"
                {...register("bedNumber")}
                className={selectClass}
                disabled={submitting}
                required
              >
                <option value="">Select a bed…</option>
                {availableBeds.map((b) => (
                  <option key={b} value={b}>
                    {b} {b === resident.bedNumber ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="edit-bedNumber"
                placeholder="e.g. B1"
                error={errors.bedNumber?.message}
                {...register("bedNumber")}
                required
              />
            )}
            {errors.bedNumber?.message && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.bedNumber.message}
              </p>
            )}
          </div>

          {/* Monthly Rent */}
          <div>
            <Input
              label="Monthly rent (Rs.)"
              type="number"
              placeholder="e.g. 8000"
              error={errors.monthlyRent?.message}
              {...register("monthlyRent")}
            />
          </div>

          {/* Resident Status */}
          <div>
            <label htmlFor="edit-status" className={labelClass}>
              Resident Status <span className="ml-0.5 text-red-600">*</span>
            </label>
            <select
              id="edit-status"
              {...register("status")}
              className={selectClass}
              disabled={submitting}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="VACATED">VACATED</option>
            </select>
            {errors.status?.message && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.status.message}
              </p>
            )}
          </div>

          {/* Payment Status */}
          <div className="sm:col-span-2">
            <label htmlFor="edit-paymentStatus" className={labelClass}>
              Payment Status <span className="ml-0.5 text-red-600">*</span>
            </label>
            <select
              id="edit-paymentStatus"
              {...register("paymentStatus")}
              className={selectClass}
              disabled={submitting}
            >
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="PARTIAL">PARTIAL</option>
            </select>
            {errors.paymentStatus?.message && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.paymentStatus.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
