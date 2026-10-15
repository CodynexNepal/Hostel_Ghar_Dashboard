"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { staffApi } from "@/lib/staff-api";
import { getHostelId, toApiError } from "@/lib/axios";
import { hostelGhar } from "@/lib/hostelGhar";
import type { CreateStaffPayload } from "@/lib/api-types";
import type { StaffMember } from "@/lib/staff-store";
import { Edit2, Loader2, Camera, Trash2, Upload } from "lucide-react";

export type StaffModalMode = "create" | "edit" | "view";

interface StaffModalProps {
  open: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  onStaffMutated: () => void;
  mode?: StaffModalMode;
  targetStaff?: StaffMember | null;
}

const ROLES = [
  "Warden",
  "Assistant Warden",
  "Cook",
  "Cleaner",
  "Security Guard",
  "Accountant",
  "Manager",
  "Maintenance",
  "Receptionist",
];

const SHIFTS = ["Morning", "Day", "Evening", "Night", "Rotational"];
const STATUSES: ("ACTIVE" | "ON LEAVE" | "INACTIVE")[] = ["ACTIVE", "ON LEAVE", "INACTIVE"];

export function StaffModal({
  open,
  onClose,
  onStaffMutated,
  mode = "create",
  targetStaff = null,
}: StaffModalProps) {
  const { success, error: toastError } = useToast();
  const [currentMode, setCurrentMode] = useState<StaffModalMode>(mode);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Real File for multipart `photo` upload (`uploadStaffPhoto`); preview is a
  // blob/data URL for instant UI feedback (never sent to the backend as text).
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    role: "Warden",
    phone: "",
    shift: "Day",
    status: "ACTIVE" as "ACTIVE" | "ON LEAVE" | "INACTIVE",
    email: "",
    salary: "",
    emergencyContact: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setCurrentMode(mode);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (targetStaff && (mode === "edit" || mode === "view")) {
      setFormData({
        name: targetStaff.name || "",
        role: targetStaff.role || "Warden",
        phone: targetStaff.phone || "",
        shift: targetStaff.shift || "Day",
        status: targetStaff.status || "ACTIVE",
        email: targetStaff.email || "",
        salary: targetStaff.salary ? String(targetStaff.salary) : "",
        emergencyContact: targetStaff.emergencyContact || "",
        notes: targetStaff.notes || "",
      });
      setAvatarPreview(targetStaff.avatarUrl || null);
    } else {
      setFormData({
        name: "",
        role: "Warden",
        phone: "",
        shift: "Day",
        status: "ACTIVE",
        email: "",
        salary: "",
        emergencyContact: "",
        notes: "",
      });
      setAvatarPreview(null);
    }
  }, [open, mode, targetStaff]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toastError("Invalid File", "Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      toastError("File Too Large", "Image size must be less than 5 MB.");
      return;
    }

    // Keep the real File for multipart `photo` upload; preview via object URL.
    setPhotoFile(file);
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.phone.trim()) {
      toastError("Validation Error", "Full Name and Phone Number are required.");
      return;
    }

    if (!formData.role.trim()) {
      toastError("Validation Error", "Role is required.");
      return;
    }

    setLoading(true);
    try {
      // Canonical backend DTO fields (`CreateStaffDto` / `UpdateStaffDto`);
      // frontend-only shift/status/notes ride along (stripped server-side).
      const payload: CreateStaffPayload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        email: formData.email.trim() || undefined,
        shift: formData.shift,
        status: formData.status,
        salary: formData.salary ? Number(formData.salary) : undefined,
        emergencyContact: formData.emergencyContact.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (currentMode === "create") {
        // POST /staff — multipart `photo` when a file was picked.
        try {
          await hostelGhar.staff.create(
            { ...payload, ...(photoFile ? { photo: photoFile } : {}) },
            getHostelId()
          );
        } catch (err) {
          console.warn("[staff] POST /staff failed, local fallback:", toApiError(err).message);
          await staffApi.post({
            name: payload.name,
            role: String(payload.role),
            phone: String(payload.phone),
            shift: String(payload.shift ?? "Day"),
            status: (payload.status as StaffMember["status"]) ?? "ACTIVE",
            email: typeof payload.email === "string" ? payload.email : undefined,
            salary: typeof payload.salary === "number" ? payload.salary : undefined,
            emergencyContact:
              typeof payload.emergencyContact === "string" ? payload.emergencyContact : undefined,
            notes: typeof payload.notes === "string" ? payload.notes : undefined,
            avatarUrl:
              avatarPreview && !avatarPreview.startsWith("blob:") ? avatarPreview : undefined,
          });
        }
        success("Staff Added", `${formData.name} has been added successfully.`);
      } else if (currentMode === "edit" && targetStaff) {
        // PUT /staff/:id → PATCH /staff/:id → local fallback.
        try {
          await hostelGhar.staff.update(targetStaff.id, payload, photoFile);
        } catch (putErr) {
          console.warn("[staff] PUT failed, trying PATCH:", toApiError(putErr).message);
          try {
            await hostelGhar.staff.patch(targetStaff.id, payload, photoFile);
          } catch (patchErr) {
            console.warn("[staff] PATCH failed, local fallback:", toApiError(patchErr).message);
            await staffApi.put(targetStaff.id, {
              name: payload.name,
              role: String(payload.role ?? ""),
              phone: String(payload.phone ?? ""),
              shift: String(payload.shift ?? "Day"),
              status: (payload.status as StaffMember["status"]) ?? "ACTIVE",
              email: typeof payload.email === "string" ? payload.email : undefined,
              salary: typeof payload.salary === "number" ? payload.salary : undefined,
              emergencyContact:
                typeof payload.emergencyContact === "string" ? payload.emergencyContact : undefined,
              notes: typeof payload.notes === "string" ? payload.notes : undefined,
              avatarUrl:
                avatarPreview && !avatarPreview.startsWith("blob:") ? avatarPreview : undefined,
            });
          }
        }
        success("Staff Updated", `Details for ${formData.name} updated successfully.`);
      }

      onStaffMutated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Operation failed";
      toastError("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  const modalTitle =
    currentMode === "create"
      ? "Add Staff Member"
      : currentMode === "edit"
        ? "Edit Staff Member"
        : "Staff Details";

  const modalDesc =
    currentMode === "create"
      ? "Add a new staff member to manage duties and shifts."
      : currentMode === "edit"
        ? "Update role, contact, or shift details for this staff member."
        : "View staff contact, shift, and duty details.";

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-lg">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">{modalTitle}</h2>
        <p className="mt-0.5 text-xs text-neutral-500">{modalDesc}</p>
      </div>

      {currentMode === "view" && targetStaff ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3.5 rounded-lg border border-neutral-200 bg-neutral-50/70 p-3.5">
            {targetStaff.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={targetStaff.avatarUrl}
                alt={targetStaff.name}
                className="h-14 w-14 rounded-full border border-neutral-200 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-lg font-bold text-brand-ink">
                {targetStaff.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900">{targetStaff.name}</h3>
                <Badge
                  tone={
                    targetStaff.status === "ACTIVE"
                      ? "green"
                      : targetStaff.status === "ON LEAVE"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {targetStaff.status}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                {targetStaff.role} · {targetStaff.shift} Shift
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-neutral-100 bg-white p-2.5">
              <span className="mb-0.5 block text-neutral-400">Phone Number</span>
              <span className="font-medium text-neutral-800">{targetStaff.phone}</span>
            </div>
            <div className="rounded-md border border-neutral-100 bg-white p-2.5">
              <span className="mb-0.5 block text-neutral-400">Email</span>
              <span className="font-medium text-neutral-800">{targetStaff.email || "—"}</span>
            </div>
            <div className="rounded-md border border-neutral-100 bg-white p-2.5">
              <span className="mb-0.5 block text-neutral-400">Monthly Salary</span>
              <span className="font-medium text-neutral-800">
                {targetStaff.salary ? `Rs. ${targetStaff.salary.toLocaleString()}` : "—"}
              </span>
            </div>
            <div className="rounded-md border border-neutral-100 bg-white p-2.5">
              <span className="mb-0.5 block text-neutral-400">Emergency Contact</span>
              <span className="font-medium text-neutral-800">
                {targetStaff.emergencyContact || "—"}
              </span>
            </div>
          </div>

          {targetStaff.notes && (
            <div className="rounded-md border border-neutral-100 bg-neutral-50 p-2.5 text-xs text-neutral-600">
              <span className="mb-0.5 block font-medium text-neutral-700">Notes:</span>
              {targetStaff.notes}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-surface-border pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="button" onClick={() => setCurrentMode("edit")} className="gap-1.5">
              <Edit2 className="h-4 w-4" /> Edit Staff
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Optional Avatar / Photo Upload */}
          <div className="flex items-center gap-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-3">
            <div className="relative flex-shrink-0">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="h-16 w-16 rounded-full border-2 border-brand/40 object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200/80 text-neutral-500">
                  <Camera className="h-6 w-6 text-neutral-400" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-neutral-800">
                Staff Photo <span className="font-normal text-neutral-400">(Optional)</span>
              </span>
              <p className="mt-0.5 text-[11px] text-neutral-500">PNG, JPG or WEBP · up to 5 MB</p>

              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="staff-avatar-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  <Upload className="h-3 w-3" />
                  {avatarPreview ? "Change Photo" : "Upload Photo"}
                </Button>

                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-1 px-1 py-0.5 text-[11px] text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Full Name"
              placeholder="e.g. Hari Bahadur"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Phone Number"
              placeholder="e.g. 9841000011"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">Shift</label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand"
              >
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as "ACTIVE" | "ON LEAVE" | "INACTIVE",
                  })
                }
                className="h-10 w-full rounded-md border border-surface-border bg-white px-3 text-sm text-neutral-900 outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Email (Optional)"
              type="email"
              placeholder="e.g. staff@hostelghar.np"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Input
              label="Monthly Salary (NPR)"
              type="number"
              placeholder="e.g. 25000"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
            />
          </div>

          <Input
            label="Emergency Contact (Optional)"
            placeholder="e.g. 9801234567"
            value={formData.emergencyContact}
            onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {currentMode === "create" ? "Add Staff" : "Save Changes"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
