"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ImagePlus, UserPlus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
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

export default function AdminOwnersPage() {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdOwner, setCreatedOwner] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);

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
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Owner image must be an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError("Owner image must be under 3 MB.");
      return;
    }
    setFormError(null);
    setImageFile(file);
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ownerName: form.ownerName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };
    const missingField = Object.entries(payload).find(([, value]) => !value)?.[0];
    if (missingField) {
      setFormError(`Please enter the owner's ${missingField}.`);
      return;
    }

    try {
      setIsCreating(true);
      await hostelGhar.admin.createOwner(payload, imageFile ?? undefined);
      success("Owner created", payload.ownerName);
      setCreatedOwner(payload.ownerName);
      setForm(EMPTY_FORM);
      setImageFile(null);
      if (imageRef.current) imageRef.current.value = "";
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
      <BackLink href="/admin" label="Platform overview" />
      <div className="mt-4 max-w-2xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>
        <Card className="mt-4">
          <CardHeader
            title="Add an owner"
            subtitle="Create an owner profile with their contact and address details."
          />
          <form onSubmit={onCreate} className="grid gap-4 p-5 sm:grid-cols-2" noValidate>
            <Input
              label="Owner name"
              placeholder="Aashish Sharma"
              value={form.ownerName}
              onChange={(event) => updateField("ownerName", event.target.value)}
              required
            />
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                Owner image
              </span>
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-surface-border bg-surface-muted">
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt="Owner preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-neutral-400" aria-hidden />
                  )}
                </span>
                <div>
                  <input
                    ref={imageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Upload owner image"
                    onChange={pickImage}
                  />
                  <Button type="button" variant="outline" onClick={() => imageRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Upload image
                  </Button>
                  <p className="mt-1 text-xs text-neutral-500">Optional, up to 3 MB</p>
                </div>
              </div>
            </div>
            <Input
              label="Owner email"
              type="email"
              placeholder="owner@example.com"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              required
            />
            <Input
              label="Phone number"
              type="tel"
              placeholder="9841000001"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              required
            />
            <Input
              label="Address"
              placeholder="Kathmandu, Nepal"
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              required
            />
            {formError && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2"
              >
                {formError}
              </p>
            )}
            {createdOwner && (
              <p className="flex items-center gap-2 text-sm text-green-700 sm:col-span-2">
                <CheckCircle2 className="h-4 w-4" /> {createdOwner} was added as an owner.
              </p>
            )}
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" loading={isCreating}>
                <UserPlus className="h-4 w-4" /> Create owner
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardShell>
  );
}
