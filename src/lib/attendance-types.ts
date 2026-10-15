"use client";
/** Shared attendance types + date helpers (local timezone). */

export type AttendanceStatus = "CHECKED_IN" | "CHECKED_OUT";

export interface AttendanceRecord {
  /** Unique: `${residentKey}::${YYYY-MM-DD}` — one row per resident per day. */
  id: string;
  residentId?: string | null;
  residentName: string;
  residentEmail?: string;
  hostelId?: string | null;
  hostelName?: string;
  roomNumber?: string;
  bedNumber?: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  status: AttendanceStatus;
  source: "backend" | "local";
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface AttendanceIdentity {
  residentId?: string | null;
  residentName: string;
  residentEmail?: string;
  hostelId?: string | null;
  hostelName?: string;
  roomNumber?: string;
  bedNumber?: string;
}

export function dayKeyLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTimeOfDay(iso?: string | null): string {
  if (!iso || typeof iso !== "string") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function durationLabel(from?: string | null, to?: string | null): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "< 1m";
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export function residentKeyOf(id: AttendanceIdentity): string {
  const raw = String(id.residentId ?? "").trim();
  if (raw) return `id:${raw.toLowerCase()}`;
  return `email:${
    String(id.residentEmail ?? "")
      .trim()
      .toLowerCase() || "unknown"
  }`;
}

export function attendanceIdFor(id: AttendanceIdentity, date: string = dayKeyLocal()): string {
  return `${residentKeyOf(id)}::${date}`;
}
