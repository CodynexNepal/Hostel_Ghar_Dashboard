"use client";
/** Check-in / check-out actions — unique per resident per day, backend-first. */
import api, { getHostelId } from "./axios";
import { toPaginated } from "./hostelGhar";
import {
  attendanceIdFor,
  dayKeyLocal,
  formatTimeOfDay,
  type AttendanceIdentity,
  type AttendanceRecord,
} from "./attendance-types";
import { normalizeRecord, readLocalAttendance, upsertLocal } from "./attendance-store";

const PREFIX = "/v1/hostel-ghar";

export type AttendanceActionError = {
  reason: "ALREADY_CHECKED_IN" | "ALREADY_CHECKED_OUT" | "NOT_CHECKED_IN";
  message: string;
};

async function tryBackend(
  path: "check-in" | "check-out",
  hostelId?: string | null
): Promise<AttendanceRecord | null> {
  try {
    const body: Record<string, unknown> = {};
    if (hostelId) body.hostelId = hostelId;
    const res = await api.post(`${PREFIX}/resident/attendance/${path}`, body);
    const payload = (res as unknown as { data?: unknown }).data ?? res;
    const root = (payload ?? {}) as Record<string, unknown>;
    return normalizeRecord(root.record ?? root.attendance ?? root.data ?? root);
  } catch {
    return null;
  }
}

export async function fetchBackendMine(): Promise<AttendanceRecord[] | null> {
  try {
    const res = await api.get(`${PREFIX}/resident/attendance`);
    return toPaginated<unknown>(res.data)
      .items.map(normalizeRecord)
      .filter((r): r is AttendanceRecord => r !== null);
  } catch {
    return null;
  }
}

export async function fetchBackendHostel(hostelId: string): Promise<AttendanceRecord[] | null> {
  try {
    const res = await api.get(`${PREFIX}/owner/attendance`, { params: { hostelId } });
    return toPaginated<unknown>(res.data)
      .items.map(normalizeRecord)
      .filter((r): r is AttendanceRecord => r !== null);
  } catch {
    /* fall through */
  }
  try {
    const res = await api.get(`${PREFIX}/hostels/${hostelId}/attendance`);
    return toPaginated<unknown>(res.data)
      .items.map(normalizeRecord)
      .filter((r): r is AttendanceRecord => r !== null);
  } catch {
    return null;
  }
}

/** Slide-to-check-in — creates today's unique record. */
export async function checkIn(
  identity: AttendanceIdentity
): Promise<AttendanceRecord | AttendanceActionError> {
  const date = dayKeyLocal();
  const id = attendanceIdFor(identity, date);
  const existing = readLocalAttendance().find((r) => r.id === id);
  if (existing) {
    return {
      reason: existing.checkOutAt ? "ALREADY_CHECKED_OUT" : "ALREADY_CHECKED_IN",
      message: existing.checkOutAt
        ? `Done for today — in ${formatTimeOfDay(existing.checkInAt)}, out ${formatTimeOfDay(existing.checkOutAt)}.`
        : `Already checked in at ${formatTimeOfDay(existing.checkInAt)}. Slide to check out.`,
    };
  }
  const now = new Date().toISOString();
  const backend = await tryBackend("check-in", identity.hostelId ?? getHostelId());
  if (backend) return upsertLocal({ ...backend, id, date, source: "backend" });
  return upsertLocal({
    id,
    residentId: identity.residentId ?? null,
    residentName: identity.residentName,
    residentEmail: identity.residentEmail,
    hostelId: identity.hostelId ?? getHostelId(),
    hostelName: identity.hostelName,
    roomNumber: identity.roomNumber,
    bedNumber: identity.bedNumber,
    date,
    checkInAt: now,
    checkOutAt: null,
    status: "CHECKED_IN",
    source: "local",
    createdAt: now,
    updatedAt: now,
  });
}

/** Slide-to-check-out — closes today's unique record. */
export async function checkOut(
  identity: AttendanceIdentity
): Promise<AttendanceRecord | AttendanceActionError> {
  const date = dayKeyLocal();
  const id = attendanceIdFor(identity, date);
  const existing = readLocalAttendance().find((r) => r.id === id);
  if (!existing) {
    return { reason: "NOT_CHECKED_IN", message: "Check in first, then check out." };
  }
  if (existing.checkOutAt) {
    return {
      reason: "ALREADY_CHECKED_OUT",
      message: `Checked out at ${formatTimeOfDay(existing.checkOutAt)}. See you tomorrow!`,
    };
  }
  const now = new Date().toISOString();
  const backend = await tryBackend("check-out", identity.hostelId ?? existing.hostelId);
  if (backend) {
    return upsertLocal({
      ...backend,
      id,
      date,
      checkOutAt: backend.checkOutAt ?? now,
      status: "CHECKED_OUT",
      updatedAt: now,
      source: "backend",
    });
  }
  return upsertLocal({ ...existing, checkOutAt: now, status: "CHECKED_OUT", updatedAt: now });
}
