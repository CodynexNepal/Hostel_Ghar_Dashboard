"use client";
/** Check-in / check-out actions — unique per resident per day, backend-first. */
import axios from "axios";
import api, { getHostelId } from "./axios";
import { toPaginated } from "./hostelGhar";
import {
  attendanceIdFor,
  dayKeyLocal,
  formatTimeOfDay,
  type AttendanceIdentity,
  type AttendanceRecord,
} from "./attendance-types";
import {
  normalizeRecord,
  readLocalAttendance,
  removeLocalAttendance,
  upsertLocal,
} from "./attendance-store";

const PREFIX = "/v1/hostel-ghar";

/**
 * Minimum interval between GET /resident/attendance calls (ms).
 * Mount loads, ATTENDANCE_EVENT refreshes and cross-tab syncs reuse the
 * cached response inside this window so the backend isn't hammered;
 * explicit `refresh()` calls pass `force: true` and bypass it.
 */
export const ATTENDANCE_FETCH_INTERVAL_MS = 60_000;

export type AttendanceActionError = {
  reason: "ALREADY_CHECKED_IN" | "ALREADY_CHECKED_OUT" | "NOT_CHECKED_IN" | "FAILED";
  message: string;
};

/** POST /resident/attendance/check-in body — `status` defaults to PRESENT. */
export type AttendanceCheckInOptions = {
  /** Backend accepts only PRESENT (default) or LATE. */
  status?: "PRESENT" | "LATE";
  note?: string;
};

type BackendAttempt =
  | { outcome: "saved"; record: AttendanceRecord | null }
  | { outcome: "conflict"; record: AttendanceRecord | null; message?: string }
  | { outcome: "rejected"; message?: string }
  | { outcome: "unavailable" };

/** Pull the saved row out of `{ record | attendance | data }` response envelopes. */
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
    if (!axios.isAxiosError(err)) return { outcome: "unavailable" };
    const status = err.response?.status ?? 0;
    const payload = err.response?.data;
    const message =
      typeof (payload as Record<string, unknown> | undefined)?.message === "string"
        ? (payload as { message: string }).message
        : undefined;
    // 409 — today's record already exists; backend sends it back in the body.
    if (status === 409) return { outcome: "conflict", record: pickRecord(payload), message };
    // 422 — validation rejected (e.g. invalid status); never mirror it locally.
    if (status >= 400 && status < 500) return { outcome: "rejected", message };
    return { outcome: "unavailable" };
  }
}

interface MineCacheEntry {
  key: string;
  at: number;
  items: AttendanceRecord[];
}

let mineCache: MineCacheEntry | null = null;

/** Drop the cached GET /resident/attendance page so the next fetch hits the backend. */
export function invalidateAttendanceCache(): void {
  mineCache = null;
}

/**
 * GET /resident/attendance?page=&limit= — the authenticated resident's own
 * history. Cached for ATTENDANCE_FETCH_INTERVAL_MS unless `force` is set.
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
    // Backend unreachable — serve the last cached page instead of blanking the UI.
    return mineCache?.key === key ? mineCache.items : null;
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

/** Slide-to-check-in — POST /resident/attendance/check-in (status defaults to PRESENT). */
export async function checkIn(
  identity: AttendanceIdentity,
  options?: AttendanceCheckInOptions
): Promise<AttendanceRecord | AttendanceActionError> {
  const date = dayKeyLocal();
  const id = attendanceIdFor(identity, date);
  const existing = readLocalAttendance().find((r) => r.id === id);
  // Only a backend-confirmed row may short-circuit. Local-only mirrors (offline
  // fallback / rows written by older builds) must still hit the API — the
  // backend is the source of truth and answers 409 with the real record.
  if (existing && existing.source === "backend") {
    return {
      reason: existing.checkOutAt ? "ALREADY_CHECKED_OUT" : "ALREADY_CHECKED_IN",
      message: existing.checkOutAt
        ? `Done for today — in ${formatTimeOfDay(existing.checkInAt)}, out ${formatTimeOfDay(existing.checkOutAt)}.`
        : `Already checked in at ${formatTimeOfDay(existing.checkInAt)}. Slide to check out.`,
    };
  }
  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    // API contract: only PRESENT | LATE accepted; defaults to PRESENT.
    status: options?.status === "LATE" ? "LATE" : "PRESENT",
  };
  const hostelId = identity.hostelId ?? getHostelId();
  if (hostelId) body.hostelId = hostelId;
  if (options?.note) body.note = options.note;

  const attempt = await tryBackend("check-in", body);
  if (attempt.outcome === "saved" && attempt.record) {
    invalidateAttendanceCache();
    return upsertLocal({ ...attempt.record, id, date, source: "backend" });
  }
  if (attempt.outcome === "conflict") {
    invalidateAttendanceCache();
    // 409 with the existing row — mirror it so the UI shows the real times.
    const rec = attempt.record
      ? upsertLocal({ ...attempt.record, id, date, source: "backend" })
      : null;
    return {
      reason: rec?.checkOutAt ? "ALREADY_CHECKED_OUT" : "ALREADY_CHECKED_IN",
      message:
        attempt.message ??
        (rec?.checkOutAt
          ? `Done for today — in ${formatTimeOfDay(rec.checkInAt)}, out ${formatTimeOfDay(rec.checkOutAt)}.`
          : rec
            ? `Already checked in at ${formatTimeOfDay(rec.checkInAt)}. Slide to check out.`
            : "Already checked in today."),
    };
  }
  if (attempt.outcome === "rejected") {
    // 422 etc. — backend refused; don't mirror it or the UI would claim a
    // check-in the server doesn't know about.
    return {
      reason: "FAILED",
      message: attempt.message ?? "Could not record check-in. Please try again.",
    };
  }
  // Backend unreachable — keep the offline local mirror.
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
  identity: AttendanceIdentity,
  options?: { note?: string }
): Promise<AttendanceRecord | AttendanceActionError> {
  const date = dayKeyLocal();
  const id = attendanceIdFor(identity, date);
  const existing = readLocalAttendance().find((r) => r.id === id);
  // Only a backend-confirmed closed row short-circuits. Anything else (no row,
  // local-only mirror) must hit the API — the backend knows the real state.
  if (existing && existing.checkOutAt && existing.source === "backend") {
    return {
      reason: "ALREADY_CHECKED_OUT",
      message: `Checked out at ${formatTimeOfDay(existing.checkOutAt)}. See you tomorrow!`,
    };
  }
  const now = new Date().toISOString();
  const body: Record<string, unknown> = {};
  const hostelId = identity.hostelId ?? existing?.hostelId ?? getHostelId();
  if (hostelId) body.hostelId = hostelId;
  if (options?.note) body.note = options.note;

  const attempt = await tryBackend("check-out", body);
  if (attempt.outcome === "saved") {
    invalidateAttendanceCache();
    const base = attempt.record ??
      existing ?? {
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
        status: "CHECKED_IN" as const,
        source: "backend" as const,
        createdAt: now,
        updatedAt: now,
      };
    return upsertLocal({
      ...base,
      id,
      date,
      checkOutAt: attempt.record?.checkOutAt ?? now,
      status: "CHECKED_OUT",
      updatedAt: now,
      source: "backend",
    });
  }
  if (attempt.outcome === "conflict") {
    invalidateAttendanceCache();
    const rec = attempt.record;
    if (rec?.checkOutAt) {
      upsertLocal({
        ...rec,
        id,
        date,
        checkOutAt: rec.checkOutAt,
        status: "CHECKED_OUT",
        source: "backend",
      });
    }
    return {
      reason: rec?.checkOutAt ? "ALREADY_CHECKED_OUT" : "NOT_CHECKED_IN",
      message:
        attempt.message ??
        (rec?.checkOutAt
          ? `Checked out at ${formatTimeOfDay(rec.checkOutAt)}. See you tomorrow!`
          : "Check in first, then check out."),
    };
  }
  if (attempt.outcome === "rejected") {
    // Backend says there's nothing to close (or the row is invalid). If our
    // only record is a local-only ghost (written when the backend was down),
    // drop it so the UI unblocks and the resident can slide to check in.
    if (existing && existing.source === "local") removeLocalAttendance(existing.id);
    return {
      reason: "FAILED",
      message: attempt.message ?? "Could not record check-out. Please try again.",
    };
  }
  // Backend unreachable — close today's local mirror if one exists.
  if (!existing) {
    return { reason: "NOT_CHECKED_IN", message: "Check in first, then check out." };
  }
  return upsertLocal({ ...existing, checkOutAt: now, status: "CHECKED_OUT", updatedAt: now });
}
