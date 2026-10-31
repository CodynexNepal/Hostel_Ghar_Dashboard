"use client";
/**
 * Check-in / check-out actions — 100% backend-driven.
 * Directly communicates with Hostel Ghar REST API. No localStorage.
 */
import axios from "axios";
import api, { getHostelId } from "./axios";
import { toPaginated } from "./hostelGhar";
import {
  attendanceIdFor,
  dayKeyLocal,
  type AttendanceIdentity,
  type AttendanceRecord,
} from "./attendance-types";
import { normalizeRecord, notifyAttendanceChanged } from "./attendance-store";

const PREFIX = "/v1/hostel-ghar";

/**
 * Cache interval for GET /resident/attendance (ms).
 * Explicit refresh() calls pass `force: true` to bypass.
 */
export const ATTENDANCE_FETCH_INTERVAL_MS = 60_000;

export type AttendanceActionError = {
  reason: "ALREADY_CHECKED_IN" | "ALREADY_CHECKED_OUT" | "NOT_CHECKED_IN" | "FAILED";
  message: string;
};

/** POST /resident/attendance/check-in body — `status` defaults to PRESENT. */
export type AttendanceCheckInOptions = {
  /** Backend accepts PRESENT (default) or LATE. */
  status?: "PRESENT" | "LATE";
  note?: string;
};

type BackendAttempt =
  | { outcome: "saved"; record: AttendanceRecord | null }
  | { outcome: "conflict"; record: AttendanceRecord | null; message?: string }
  | { outcome: "rejected"; message?: string }
  | { outcome: "unavailable"; message?: string };

/** Extract saved row from `{ record | attendance | data }` response envelopes. */
function pickRecord(payload: unknown): AttendanceRecord | null {
  const root = (payload ?? {}) as Record<string, unknown>;
  const nested = (root.data ?? {}) as Record<string, unknown>;
  return normalizeRecord(
    root.record ??
      root.attendance ??
      root.existing ??
      nested.record ??
      nested.attendance ??
      root.data ??
      root
  );
}

async function tryBackend(
  path: "check-in" | "check-out",
  body: Record<string, unknown>
): Promise<BackendAttempt> {
  try {
    const res = await api.post(`${PREFIX}/resident/attendance/${path}`, body);
    const payload = (res as unknown as { data?: unknown }).data ?? res;
    return { outcome: "saved", record: pickRecord(payload) };
  } catch (err) {
    if (!axios.isAxiosError(err)) {
      return { outcome: "unavailable", message: "Network connection error." };
    }
    const status = err.response?.status ?? 0;
    const payload = err.response?.data as Record<string, unknown> | undefined;
    const rawMsg = payload?.message;
    const message =
      typeof rawMsg === "string"
        ? rawMsg
        : Array.isArray(rawMsg)
          ? rawMsg.join(", ")
          : typeof payload?.error === "string"
            ? (payload.error as string)
            : undefined;

    // 409 Conflict: already checked in / already checked out
    if (status === 409) {
      return { outcome: "conflict", record: pickRecord(payload), message };
    }
    // 400 Bad Request or 422 Unprocessable
    if (status >= 400 && status < 500) {
      return { outcome: "rejected", message };
    }
    return { outcome: "unavailable", message: message ?? "Backend service unavailable." };
  }
}

interface MineCacheEntry {
  key: string;
  at: number;
  items: AttendanceRecord[];
}

let mineCache: MineCacheEntry | null = null;

/** Invalidate cached GET /resident/attendance */
export function invalidateAttendanceCache(): void {
  mineCache = null;
}

/**
 * GET /resident/attendance?page=&limit= — authenticated resident's history.
 */
export async function fetchBackendMine(opts?: {
  page?: number;
  limit?: number;
  force?: boolean;
}): Promise<AttendanceRecord[] | null> {
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 30;
  const key = `${page}:${limit}`;
  const now = Date.now();
  if (!opts?.force && mineCache?.key === key && now - mineCache.at < ATTENDANCE_FETCH_INTERVAL_MS) {
    return mineCache.items;
  }
  try {
    const res = await api.get(`${PREFIX}/resident/attendance`, { params: { page, limit } });
    const items = toPaginated<unknown>(res.data)
      .items.map(normalizeRecord)
      .filter((r): r is AttendanceRecord => r !== null);
    mineCache = { key, at: now, items };
    return items;
  } catch {
    return mineCache?.key === key ? mineCache.items : null;
  }
}

/**
 * GET /owner/attendance?hostelId= — hostel-wide attendance records for owner/admin.
 */
export async function fetchBackendHostel(hostelId: string): Promise<AttendanceRecord[] | null> {
  try {
    const res = await api.get(`${PREFIX}/owner/attendance`, { params: { hostelId, limit: 100 } });
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

/**
 * Resident check-in: calls POST /v1/hostel-ghar/resident/attendance/check-in.
 * Pure backend integration with zero localStorage dependency.
 */
export async function checkIn(
  identity: AttendanceIdentity,
  options?: AttendanceCheckInOptions
): Promise<AttendanceRecord | AttendanceActionError> {
  const body: Record<string, unknown> = {
    status: options?.status === "LATE" ? "LATE" : "PRESENT",
  };
  const hostelId = identity.hostelId ?? getHostelId();
  if (hostelId) body.hostelId = hostelId;
  if (options?.note) body.note = options.note;

  const attempt = await tryBackend("check-in", body);

  if (attempt.outcome === "saved") {
    invalidateAttendanceCache();
    notifyAttendanceChanged();
    return (
      attempt.record ?? {
        id: attendanceIdFor(identity),
        residentId: identity.residentId,
        residentName: identity.residentName,
        residentEmail: identity.residentEmail,
        hostelId: identity.hostelId,
        date: dayKeyLocal(),
        checkInAt: new Date().toISOString(),
        checkOutAt: null,
        status: "CHECKED_IN",
        source: "backend",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  if (attempt.outcome === "conflict") {
    invalidateAttendanceCache();
    notifyAttendanceChanged();
    return {
      reason: "ALREADY_CHECKED_IN",
      message: attempt.message ?? "You have already checked in today.",
    };
  }

  if (attempt.outcome === "rejected") {
    return {
      reason: "FAILED",
      message: attempt.message ?? "Could not record check-in. Please try again.",
    };
  }

  if (attempt.outcome === "unavailable") {
    return {
      reason: "FAILED",
      message: attempt.message ?? "Backend server unavailable. Please try again in a moment.",
    };
  }

  return {
    reason: "FAILED",
    message: "Could not record check-in. Please try again.",
  };
}

/**
 * Resident check-out: calls POST /v1/hostel-ghar/resident/attendance/check-out.
 * Pure backend integration with zero localStorage dependency.
 */
export async function checkOut(
  identity: AttendanceIdentity,
  options?: { note?: string }
): Promise<AttendanceRecord | AttendanceActionError> {
  const body: Record<string, unknown> = {};
  const hostelId = identity.hostelId ?? getHostelId();
  if (hostelId) body.hostelId = hostelId;
  if (options?.note) body.note = options.note;

  const attempt = await tryBackend("check-out", body);

  if (attempt.outcome === "saved") {
    invalidateAttendanceCache();
    notifyAttendanceChanged();
    return (
      attempt.record ?? {
        id: attendanceIdFor(identity),
        residentId: identity.residentId,
        residentName: identity.residentName,
        residentEmail: identity.residentEmail,
        hostelId: identity.hostelId,
        date: dayKeyLocal(),
        checkInAt: new Date().toISOString(),
        checkOutAt: new Date().toISOString(),
        status: "CHECKED_OUT",
        source: "backend",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  if (attempt.outcome === "conflict") {
    invalidateAttendanceCache();
    notifyAttendanceChanged();
    return {
      reason: "ALREADY_CHECKED_OUT",
      message: attempt.message ?? "You have already checked out today.",
    };
  }

  if (attempt.outcome === "rejected") {
    return {
      reason: "NOT_CHECKED_IN",
      message: attempt.message ?? "Please check in first, then check out.",
    };
  }

  if (attempt.outcome === "unavailable") {
    return {
      reason: "FAILED",
      message: attempt.message ?? "Backend server unavailable. Please try again in a moment.",
    };
  }

  return {
    reason: "FAILED",
    message: "Could not record check-out. Please try again.",
  };
}
