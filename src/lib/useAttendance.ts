"use client";
/** React hooks for resident + owner attendance views. */
import { useCallback, useEffect, useState } from "react";
import {
  dayKeyLocal,
  residentKeyOf,
  type AttendanceIdentity,
  type AttendanceRecord,
} from "./attendance-types";
import {
  ATTENDANCE_EVENT,
  listLocalAttendance,
  readLocalAttendance,
  writeLocalAttendance,
} from "./attendance-store";
import { fetchBackendHostel, fetchBackendMine } from "./attendance-actions";

export interface MyAttendanceState {
  today: AttendanceRecord | null;
  history: AttendanceRecord[];
  isLoading: boolean;
  nextAction: "CHECK_IN" | "CHECK_OUT" | "DONE";
  refresh: () => Promise<void>;
}

export function useMyAttendance(identity: AttendanceIdentity | null): MyAttendanceState {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const key = identity ? residentKeyOf(identity) : "";

  const load = useCallback(async () => {
    if (!identity) {
      setHistory([]);
      setIsLoading(false);
      return;
    }
    const backend = await fetchBackendMine();
    let rows: AttendanceRecord[];
    if (backend && backend.length > 0) {
      const merged = new Map<string, AttendanceRecord>();
      for (const r of readLocalAttendance()) merged.set(r.id, r);
      for (const r of backend) {
        const prev = merged.get(r.id);
        if (prev?.checkOutAt && !r.checkOutAt) {
          merged.set(r.id, { ...r, checkOutAt: prev.checkOutAt, status: "CHECKED_OUT" });
        } else merged.set(r.id, r);
      }
      rows = [...merged.values()];
      writeLocalAttendance(rows);
    } else {
      rows = readLocalAttendance();
    }
    setHistory(rows.filter((r) => r.id.startsWith(`${key}::`)));
    setIsLoading(false);
    // Identity object identity changes every render; key scopes to the same resident.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(ATTENDANCE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(ATTENDANCE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  const today = history.find((r) => r.date === dayKeyLocal()) ?? null;
  const nextAction: MyAttendanceState["nextAction"] = !today
    ? "CHECK_IN"
    : today.checkOutAt
      ? "DONE"
      : "CHECK_OUT";
  return { today, history, isLoading, nextAction, refresh: load };
}

export interface HostelAttendanceState {
  records: AttendanceRecord[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useHostelAttendance(hostelId?: string | null): HostelAttendanceState {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!hostelId) {
      setRecords(readLocalAttendance());
      setIsLoading(false);
      return;
    }
    const backend = await fetchBackendHostel(hostelId);
    let rows: AttendanceRecord[];
    if (backend && backend.length > 0) {
      const merged = new Map<string, AttendanceRecord>();
      for (const r of readLocalAttendance()) merged.set(r.id, r);
      for (const r of backend) if (!merged.has(r.id)) merged.set(r.id, r);
      rows = [...merged.values()].filter((r) => !r.hostelId || r.hostelId === hostelId);
    } else {
      rows = listLocalAttendance({ hostelId });
    }
    setRecords(rows);
    setIsLoading(false);
  }, [hostelId]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(ATTENDANCE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(ATTENDANCE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  return { records, isLoading, refresh: load };
}
