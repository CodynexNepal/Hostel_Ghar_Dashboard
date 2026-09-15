"use client";
import { useEffect, useRef, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { BackLink } from "@/components/ui/BackLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Hostel } from "@/types/hostel";
import { useToast } from "@/hooks/useToast";
import { useApi } from "@/hooks/useApi";
import { hostelGhar, toApiError, toPaginated } from "@/lib/hostelGhar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Ban, CheckCircle2, ImagePlus, Plus } from "lucide-react";

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
    return toPaginated<Hostel>(res.data).items;
  }, []);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement | null>(null);
  const hostels = data ?? [];

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
    { key: "ownerName", header: "Owner", sortable: true, render: (hostel) => hostel.ownerName },
    {
      key: "occupiedBeds",
      header: "Occupancy",
      sortable: true,
      render: (hostel) => `${hostel.occupiedBeds}/${hostel.totalBeds}`,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (hostel) => (
        <Badge tone={hostel.status === "ACTIVE" ? "green" : "amber"}>{hostel.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (hostel) => (
        <span className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => success("Hostel opened", hostel.name)}>
            View
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Status of ${hostel.name}`}
            title="Suspend is enforced by backend admin API."
            onClick={() =>
              toastError("Status change unavailable", "Use the backend admin API to suspend.")
            }
          >
            {hostel.status === "ACTIVE" ? (
              <Ban className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-700" />
            )}
          </Button>
        </span>
      ),
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
                <span className="block text-xs text-neutral-500">
                  {hostel.ownerName} · {hostel.occupiedBeds}/{hostel.totalBeds}
                </span>
              </span>
              <Badge tone={hostel.status === "ACTIVE" ? "green" : "amber"}>{hostel.status}</Badge>
            </div>
          )}
        />
      )}
      <Card className="mt-4 p-4 text-[13px] text-neutral-500">
        Suspending a hostel immediately blocks owner logins and resident payments — backend enforces
        authorization on every request.
      </Card>
    </DashboardShell>
  );
}
