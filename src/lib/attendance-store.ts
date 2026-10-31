"use client";
/**
 * Attendance record normalization and event notifications.
 * Pure backend-driven — no localStorage storage or mirrors.
 */
import {
  attendanceIdFor,
  dayKeyLocal,
  type AttendanceIdentity,
  type AttendanceRecord,
} from "./attendance-types";

export const ATTENDANCE_EVENT = "hg:attendance-changed";

export function notifyAttendanceChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ATTENDANCE_EVENT));
  }
}

/**
 * Normalizes an attendance entity from backend API responses
 * (/resident/attendance, /owner/attendance, or /resident/attendance/check-in/out).
 */
export function normalizeRecord(raw: unknown): AttendanceRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, fb = ""): string =>
    typeof v === "string" ? v : v === undefined || v === null ? fb : String(v);

  const checkInAt =
    str(
      r.checkInAt ??
        r.check_in_at ??
        r.checkInTime ??
        r.check_in_time ??
        r.checkIn ??
        r.check_in ??
        r.createdAt ??
        r.created_at ??
        r.timestamp ??
        r.updatedAt ??
        r.updated_at
    ) || (r.id || r.residentId || r.checkOutAt || r.check_out_at ? new Date().toISOString() : "");

  if (!checkInAt) return null;

  const outRaw = (r.checkOutAt ??
    r.check_out_at ??
    r.checkOutTime ??
    r.check_out_time ??
    null) as unknown;
  const checkOutAt = typeof outRaw === "string" && outRaw ? outRaw : null;
  const date = str(r.date ?? r.day ?? "") || dayKeyLocal(new Date(checkInAt));

  const residentObj = (r.resident && typeof r.resident === "object" ? r.resident : {}) as Record<
    string,
    unknown
  >;
  const userObj = (
    residentObj.user && typeof residentObj.user === "object" ? residentObj.user : {}
  ) as Record<string, unknown>;

  const residentId = str(r.residentId ?? residentObj.id ?? r.userId ?? "") || null;
  const residentEmail = str(r.residentEmail ?? userObj.email ?? r.email ?? "") || undefined;

  const userFirst = str(userObj.firstName ?? userObj.first_name);
  const userLast = str(userObj.lastName ?? userObj.last_name);
  const composedUserName = `${userFirst} ${userLast}`.trim();

  const residentName =
    str(r.residentName) ||
    composedUserName ||
    str(residentObj.name) ||
    str(r.fullName ?? r.name ?? "Resident");

  const identity: AttendanceIdentity = {
    residentId,
    residentName,
    residentEmail,
  };

  const statusRaw = str(r.status ?? "").toUpperCase();
  const status: "CHECKED_IN" | "CHECKED_OUT" =
    checkOutAt || statusRaw === "CHECKED_OUT" ? "CHECKED_OUT" : "CHECKED_IN";

  return {
    id: str(r.id) || attendanceIdFor(identity, date),
    residentId,
    residentName,
    residentEmail,
    hostelId: str(r.hostelId ?? "") || null,
    hostelName: str(r.hostelName ?? "") || undefined,
    roomNumber: str(r.roomNumber ?? r.room ?? "") || undefined,
    bedNumber: str(r.bedNumber ?? r.bed ?? "") || undefined,
    date,
    checkInAt,
    checkOutAt,
    status,
    source: "backend",
    createdAt: str(r.createdAt ?? checkInAt, checkInAt),
    updatedAt: str(r.updatedAt ?? checkOutAt ?? checkInAt, checkInAt),
  };
}
