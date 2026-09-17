"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  FACILITY_TAGS,
  facilitySchema,
  type FacilityFormValues,
} from "@/schemas/facility.schema";

export interface FacilityItem {
  /** Frontend-stable key (= backend `clientKey`, e.g. `security-mu5ofghs`). */
  id: string;
  title: string;
  description: string;
  tag: string;
  /** DB junction UUID (`id` in GET payload) — accepted by DELETE as fallback. */
  junctionId?: string;
  /** Raw backend `clientKey` (equals `id` when present). */
  clientKey?: string;
  slug?: string;
  facilityId?: string;
}

const inputClass =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand";
const labelClass = "mb-1.5 block text-[13px] font-medium text-neutral-800";
const errorClass = "mt-1 text-xs text-red-600";

export function AddFacilityModal({
  open,
  onClose,
  onSubmit,
  initialFacility = null,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: FacilityFormValues) => void | Promise<void>;
  initialFacility?: FacilityItem | null;
}) {
  const isEditing = Boolean(initialFacility);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FacilityFormValues>({
    resolver: yupResolver(facilitySchema),
    defaultValues: {
      title: "",
      description: "",
      tag: "Included",
    },
  });

  // Prefill when editing, reset when creating. Coerce legacy tags
  // (Limited / Add-on / PRO hostels) to the backend enum so editing an old
  // row never re-submits a value the API rejects with 400.
  function coerceTag(tag: string): FacilityFormValues["tag"] {
    if ((FACILITY_TAGS as readonly string[]).includes(tag)) {
      return tag as FacilityFormValues["tag"];
    }
    if (/extra|charge|add-?on|paid/i.test(tag)) return "Extra Charge";
    if (/exclud|not/i.test(tag)) return "Excluded";
    return "Included";
  }

  useEffect(() => {
    if (!open) return;
    if (initialFacility) {
      reset({
        title: initialFacility.title,
        description: initialFacility.description,
        tag: coerceTag(initialFacility.tag),
      });
    } else {
      reset({ title: "", description: "", tag: "Included" });
    }
  }, [open, initialFacility, reset]);

  async function onValid(values: FacilityFormValues) {
    await onSubmit(values);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit facility" : "Add facility"}
      description="Shared amenities shown to residents on this page."
    >
      <form onSubmit={handleSubmit(onValid)} className="grid gap-4" noValidate>
        <Input
          label="Facility name"
          placeholder="e.g. Mess & dining"
          error={errors.title?.message}
          {...register("title")}
          required
        />

        <Input
          label="Description"
          placeholder="e.g. 3 meals + snacks"
          error={errors.description?.message}
          {...register("description")}
          required
        />

        <div>
          <label htmlFor="facility-tag" className={labelClass}>
            Tag <span className="ml-0.5 text-red-600">*</span>
          </label>
          <select id="facility-tag" {...register("tag")} className={inputClass}>
            {FACILITY_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errors.tag?.message && (
            <p role="alert" className={errorClass}>
              {errors.tag.message}
            </p>
          )}
          <p className="mt-1.5 text-xs text-neutral-500">
            Included / Excluded / Extra Charge — matches the badge on each card.
          </p>
        </div>

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
                : "Add Facility"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
