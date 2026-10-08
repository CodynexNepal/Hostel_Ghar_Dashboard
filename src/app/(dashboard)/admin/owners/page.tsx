"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ImagePlus, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";
import { hostelGhar, toApiError } from "@/lib/hostelGhar";

const EMPTY_FORM = {
  ownerName: "",
  email: "",
  phone: "",
  address: "",
};

/** Friendly names for the required-field validation message. */
const FIELD_LABELS: Record<keyof typeof EMPTY_FORM, string> = {
  ownerName: "name",
  email: "email address",
  phone: "phone number",
  address: "address",
};

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Owner image picker: circular preview, drag & drop zone and an optional
 * remove action. Stacks on small screens and sits side-by-side from `sm`.
 */
function ImageField({
  imageRef,
  preview,
  hasImage,
  isDragging,
  onPick,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
}: {
  imageRef: React.RefObject<HTMLInputElement | null>;
  preview: string | null;
  hasImage: boolean;
  isDragging: boolean;
  onPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className="md:col-span-2">
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-800">Owner image</span>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          onDragOver();
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-4 rounded-lg border border-dashed p-4 text-center transition-colors sm:flex-row sm:p-5 sm:text-left ${
          isDragging ? "border-brand-ink bg-brand-muted" : "border-surface-border bg-surface-muted"
        }`}
      >
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-surface-border bg-white">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Owner preview" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-neutral-400" aria-hidden />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
          <input
            ref={imageRef}
            id="ownerImage"
            name="ownerImage"
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload owner image"
            onChange={onPick}
          />
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => imageRef.current?.click()}
              className="w-full sm:w-auto"
            >
              <ImagePlus className="h-4 w-4" /> Upload image
            </Button>
            {hasImage && (
              <Button type="button" variant="ghost" onClick={onClear} className="w-full sm:w-auto">
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Optional, up to 3 MB. Drag &amp; drop or browse.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminOwnersPage() {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdOwner, setCreatedOwner] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const createOwnerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function updateField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setCreatedOwner(null);
  }

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    validateImage(file);
  }

  /** Shared validation for the file input and the drag & drop zone. */
  function validateImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Owner image must be an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError("Owner image must be under 3 MB.");
      return;
    }
    setFormError(null);
    setImageFile(file);
  }

  function onDropImage(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    validateImage(event.dataTransfer.files?.[0] ?? null);
  }

  function clearImage() {
    setImageFile(null);
    if (imageRef.current) imageRef.current.value = "";
    setFormError(null);
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ownerName: form.ownerName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };
    const missingField = (Object.keys(payload) as (keyof typeof payload)[]).find(
      (key) => !payload[key]
    );
    if (missingField) {
      setFormError(`Please enter the owner's ${FIELD_LABELS[missingField]}.`);
      return;
    }
    if (!EMAIL_RE.test(payload.email)) {
      setFormError("Please enter a valid owner email address.");
      return;
    }

    try {
      setIsCreating(true);
      await hostelGhar.admin.createOwner(payload, imageFile ?? undefined);
      success("Owner created", payload.ownerName);
      setCreatedOwner(payload.ownerName);
      setForm(EMPTY_FORM);
      setImageFile(null);
      setIsDragging(false);
      if (imageRef.current) imageRef.current.value = "";
      createOwnerRef.current?.focus();
    } catch (error) {
      const message = toApiError(error).message;
      setFormError(message);
      toastError("Couldn't create owner", message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <DashboardShell title="Create owner" subtitle="Hostel Ghar / Admin / Owners">
      <Protected roles={["SUPER_ADMIN"]} redirectTo="/dashboard">
        {/* Full-viewport centered layout: the negative margins escape the
            shell's main padding so the card centers in the whole page
            instead of hugging the left rail. */}
        <div className="-mx-4 -my-5 flex min-h-[calc(100dvh-4rem-1.5rem)] items-center justify-center px-4 py-6 sm:-mx-6 sm:px-6 sm:py-8">
          <div className="w-full">
            <div className="mx-auto mb-4 flex max-w-2xl flex-col gap-1 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <BackLink href="/admin" label="Platform overview" />
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
              >
                <ArrowLeft className="h-4 w-4" /> Back to admin
              </Link>
            </div>
            <Card className="mx-auto w-full max-w-2xl">
              <CardHeader
                title="Add an owner"
                subtitle="Create an owner profile with their contact and address details."
              />
              <form
                onSubmit={onCreate}
                className="grid gap-4 p-4 sm:gap-5 sm:p-5 md:grid-cols-2"
                noValidate
              >
                <Input
                  id="ownerName"
                  name="ownerName"
                  label="Owner name"
                  placeholder="Aashish Sharma"
                  autoComplete="name"
                  value={form.ownerName}
                  onChange={(event) => updateField("ownerName", event.target.value)}
                  required
                />
                <ImageField
                  imageRef={imageRef}
                  preview={imagePreview}
                  hasImage={Boolean(imageFile)}
                  isDragging={isDragging}
                  onPick={pickImage}
                  onDragOver={() => setIsDragging(true)}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDropImage}
                  onClear={clearImage}
                />
                <Input
                  id="email"
                  name="email"
                  label="Owner email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="owner@example.com"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  required
                />
                <Input
                  id="phone"
                  name="phone"
                  label="Phone number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9841000001"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  required
                />
                <div className="md:col-span-2">
                  <Input
                    id="address"
                    name="address"
                    label="Address"
                    autoComplete="street-address"
                    placeholder="Kathmandu, Nepal"
                    value={form.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    required
                  />
                </div>
                {formError && (
                  <p
                    role="alert"
                    className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2"
                  >
                    {formError}
                  </p>
                )}
                {createdOwner && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 md:col-span-2"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> {createdOwner} was added as an
                    owner.
                  </p>
                )}
                <div className="flex flex-col-reverse gap-2 md:col-span-2 md:flex-row md:justify-end">
                  <Button
                    type="submit"
                    loading={isCreating}
                    className="w-full md:w-auto"
                    ref={createOwnerRef}
                  >
                    <UserPlus className="h-4 w-4" /> Create owner
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </Protected>
    </DashboardShell>
  );
}
