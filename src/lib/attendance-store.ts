"use client";
/** Local attendance mirror — offline/pre-backend source, unique per resident per day. */
import {
  attendanceIdFor,
  dayKeyLocal,
  type AttendanceIdentity,
  type AttendanceRecord,
} from "./attendance-types";

const LS_KEY = "hg_attendance_v1";
export const ATTENDANCE_EVENT = "hg:attendance-changed";

export function readLocalAttendance(): AttendanceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AttendanceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalAttendance(rows: AttendanceRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const next = [...rows].sort((a, b) => b.date.localeCompare(a.date));
    const serialized = JSON.stringify(next.slice(0, 2000));
    // Skip no-op writes AND skip the change event — hooks listening on
    // ATTENDANCE_EVENT re-fetch + re-write, so dispatching on identical data
    // would loop GET /resident/attendance forever.
    if (window.localStorage.getItem(LS_KEY) === serialized) return;
    window.localStorage.setItem(LS_KEY, serialized);
  } catch {
    /* quota — memory only */
  }
  window.dispatchEvent(new CustomEvent(ATTENDANCE_EVENT));
}

export function upsertLocal(row: AttendanceRecord): AttendanceRecord {
  const rows = readLocalAttendance();
  const idx = rows.findIndex((r) => r.id === row.id);
  if (idx >= 0) rows[idx] = row;
  else rows.unshift(row);
  writeLocalAttendance(rows);
  return row;
}

/** Remove a local-only row (e.g. ghost records written when the backend was down). */
export function removeLocalAttendance(id: string): void {
  const rows = readLocalAttendance().filter((r) => r.id !== id);
  writeLocalAttendance(rows);
}

export function listLocalAttendance(filter?: {
  hostelId?: string | null;
  residentEmail?: string;
  date?: string;
}): AttendanceRecord[] {
  let rows = readLocalAttendance();
  if (filter?.hostelId) rows = rows.filter((r) => !r.hostelId || r.hostelId === filter.hostelId);
  if (filter?.residentEmail)
    rows = rows.filter(
      (r) => (r.residentEmail ?? "").toLowerCase() === filter.residentEmail!.toLowerCase()
    );
  if (filter?.date) rows = rows.filter((r) => r.date === filter.date);
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function normalizeRecord(raw: unknown): AttendanceRecord | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb = ""): string =>
    typeof v === "string" ? v : v === undefined || v === null ? fb : String(v);
  const checkInAt = str(r.checkInAt ?? r.check_in_at ?? r.createdAt);
  if (!checkInAt) return null;
  const outRaw = (r.checkOutAt ?? r.check_out_at ?? null) as unknown;
  const checkOutAt = typeof outRaw === "string" && outRaw ? outRaw : null;
  const date = str(r.date ?? r.day ?? "") || dayKeyLocal(new Date(checkInAt));
  const residentId = str(r.residentId ?? r.userId ?? "") || null;
  const residentEmail = str(r.residentEmail ?? r.email ?? "") || undefined;
  const identity: AttendanceIdentity = {
    residentId,
    residentName: str(r.residentName ?? r.fullName ?? r.name ?? "Resident"),
    residentEmail,
  };
  return {
    id: str(r.id) || attendanceIdFor(identity, date),
    residentId,
    residentName: identity.residentName,
    residentEmail,
    hostelId: str(r.hostelId ?? "") || null,
    hostelName: str(r.hostelName ?? "") || undefined,
    roomNumber: str(r.roomNumber ?? r.room ?? "") || undefined,
    bedNumber: str(r.bedNumber ?? r.bed ?? "") || undefined,
    date,
    checkInAt,
    checkOutAt,
    status: checkOutAt ? "CHECKED_OUT" : "CHECKED_IN",
    source: "backend",
    createdAt: str(r.createdAt ?? checkInAt, checkInAt),
    updatedAt: str(r.updatedAt ?? checkOutAt ?? checkInAt, checkInAt),
  };
}
