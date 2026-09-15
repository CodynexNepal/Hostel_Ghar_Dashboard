"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { roomSchema, type RoomFormValues } from "@/schemas/room.schema";
import type { Room, RoomStatus, RoomType } from "@/types/hostel";

export interface NewRoomPayload {
  values: RoomFormValues;
  amenities: string[];
  imageFile: File | null;
  imagePreviewUrl: string | null;
  room: Room;
}

const ROOM_TYPES: RoomType[] = ["SINGLE", "DOUBLE", "TRIPLE", "DORM"];
const ROOM_STATUSES: RoomStatus[] = ["AVAILABLE", "OCCUPIED", "FULL", "MAINTENANCE"];

const inputClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand";
const labelClass = "mb-1.5 block text-[13px] font-medium text-neutral-800";
const errorClass = "mt-1 text-xs text-red-600";

export function AddRoomModal({
  open,
  onClose,
  onSubmit,
  initialRoom = null,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewRoomPayload) => void | Promise<void>;
  initialRoom?: Room | null;
}) {
  const isEditing = Boolean(initialRoom);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RoomFormValues>({
    resolver: yupResolver(roomSchema),
    defaultValues: {
      roomNumber: "",
      floor: 1,
      type: "DOUBLE",
      capacity: 2,
      monthlyRent: 12000,
      status: "AVAILABLE",
      amenities: "",
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Prefill when editing; reset when creating.
  useEffect(() => {
    if (!open) return;
    if (initialRoom) {
      setValue("roomNumber", initialRoom.roomNumber);
      setValue("floor", initialRoom.floor);
      setValue("type", initialRoom.type);
      setValue("capacity", initialRoom.capacity);
      setValue("monthlyRent", initialRoom.monthlyRent);
      setValue("status", initialRoom.status);
      setValue("amenities", (initialRoom.amenities ?? []).join(", "));
      setImageFile(null);
      setImageError(null);
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(initialRoom.imageUrl ?? null);
    } else {
      reset();
      setImageFile(null);
      setImageError(null);
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRoom?.id]);

  function handleFileChange(file: File | undefined) {
    setImageError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be smaller than 5 MB.");
      return;
    }
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function removeImage() {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl(null);
    setImageError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onValid(data: RoomFormValues) {
    setIsSubmitting(true);
    const amenities = (data.amenities ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    const room: Room = initialRoom
      ? {
          ...initialRoom,
          roomNumber: data.roomNumber.trim(),
          floor: Number(data.floor),
          type: data.type as RoomType,
          capacity: Number(data.capacity),
          monthlyRent: Number(data.monthlyRent),
          status: data.status as RoomStatus,
          amenities,
          imageUrl: previewUrl ?? initialRoom.imageUrl ?? null,
        }
      : {
          id: `rm-${data.roomNumber.trim().toLowerCase()}-${Date.now()}`,
          roomNumber: data.roomNumber.trim(),
          floor: Number(data.floor),
          type: data.type as RoomType,
          capacity: Number(data.capacity),
          occupied: data.status === "FULL" ? Number(data.capacity) : 0,
          monthlyRent: Number(data.monthlyRent),
          status: data.status as RoomStatus,
          amenities,
          imageUrl: previewUrl,
        };
    const payload: NewRoomPayload = {
      values: { ...data, roomNumber: data.roomNumber.trim() },
      amenities,
      imageFile,
      imagePreviewUrl: previewUrl,
      room,
    };
    // Required: log the full result (values + image meta) to the console.
    console.log(isEditing ? "[EditRoom] submitted:" : "[AddRoom] submitted:", {
      ...payload.values,
      amenities: payload.amenities,
      image: imageFile
        ? { name: imageFile.name, size: imageFile.size, type: imageFile.type, previewUrl }
        : null,
      room,
    });
    try {
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Room" : "Add Room"}
      description={
        isEditing
          ? `Update Room ${initialRoom?.roomNumber} — rent, status or photo.`
          : "Floor, type, rent, status and a room photo."
      }
    >
      <form onSubmit={handleSubmit(onValid)} className="grid gap-4" noValidate>
        <div>
          <span className={labelClass}>
            Room photo <span className="font-normal text-neutral-400">(optional)</span>
          </span>
          {previewUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-surface-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Room preview" className="h-40 w-full object-cover" />
              <button
                type="button"
                onClick={removeImage}
                aria-label="Remove room photo"
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
              {imageFile && (
                <p className="truncate bg-neutral-900/80 px-3 py-1.5 text-xs text-white">
                  {imageFile.name} · {(imageFile.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-surface-border bg-surface-muted/50 px-4 py-6 text-sm text-neutral-500 hover:border-brand-ink hover:text-neutral-800"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card">
                <ImagePlus className="h-5 w-5 text-brand-ink" />
              </span>
              <span className="font-medium">Upload room image</span>
              <span className="text-xs text-neutral-400">PNG, JPG or WEBP · max 5 MB</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Room photo"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
          {!previewUrl && (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" /> Choose image
              </Button>
            </div>
          )}
          {imageError && (
            <p role="alert" className={errorClass}>
              {imageError}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Room number"
            placeholder="e.g. 207"
            error={errors.roomNumber?.message}
            {...register("roomNumber")}
            required
          />
          <Input
            label="Floor"
            type="number"
            min={0}
            error={errors.floor?.message}
            {...register("floor")}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="room-type" className={labelClass}>
              Room type <span className="ml-0.5 text-red-600">*</span>
            </label>
            <select id="room-type" {...register("type")} className={inputClass}>
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            {errors.type?.message && (
              <p role="alert" className={errorClass}>
                {errors.type.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="room-status" className={labelClass}>
              Status <span className="ml-0.5 text-red-600">*</span>
            </label>
            <select id="room-status" {...register("status")} className={inputClass}>
              {ROOM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            {errors.status?.message && (
              <p role="alert" className={errorClass}>
                {errors.status.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Capacity (beds)"
            type="number"
            min={1}
            max={12}
            error={errors.capacity?.message}
            {...register("capacity")}
            required
          />
          <Input
            label="Monthly rent (Rs.)"
            type="number"
            min={1}
            placeholder="12000"
            error={errors.monthlyRent?.message}
            {...register("monthlyRent")}
            required
          />
        </div>

        <Input
          label="Amenities (comma separated)"
          placeholder="Wifi, Hot water, AC"
          error={errors.amenities?.message}
          {...register("amenities")}
        />

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {isSubmitting
              ? isEditing
                ? "Saving…"
                : "Adding…"
              : isEditing
                ? "Save Changes"
                : "Add Room"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
