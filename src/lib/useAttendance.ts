"use client";
/** React hooks for resident + owner attendance views — 100% backend-driven. */
import { useCallback, useEffect, useState } from "react";
import { dayKeyLocal, type AttendanceIdentity, type AttendanceRecord } from "./attendance-types";
import { ATTENDANCE_EVENT } from "./attendance-store";
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

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!identity) {
        setHistory([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const backend = await fetchBackendMine({ page: 1, limit: 30, force: opts?.force });
      if (backend && Array.isArray(backend)) {
        setHistory(backend);
      } else {
        setHistory([]);
      }
      setIsLoading(false);
    },
    // Scoped by identity existence
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identity?.residentId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChange = () => void load({ force: true });
    window.addEventListener(ATTENDANCE_EVENT, onChange);
    return () => {
      window.removeEventListener(ATTENDANCE_EVENT, onChange);
    };
  }, [load]);

  const refresh = useCallback(() => load({ force: true }), [load]);

  const today = history.find((r) => r.date === dayKeyLocal()) ?? null;
  const nextAction: MyAttendanceState["nextAction"] = !today
    ? "CHECK_IN"
    : today.checkOutAt
      ? "DONE"
      : "CHECK_OUT";

  return { today, history, isLoading, nextAction, refresh };
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
      setRecords([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const backend = await fetchBackendHostel(hostelId);
    setRecords(backend ?? []);
    setIsLoading(false);
  }, [hostelId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(ATTENDANCE_EVENT, onChange);
    return () => {
      window.removeEventListener(ATTENDANCE_EVENT, onChange);
    };
  }, [load]);

  return { records, isLoading, refresh: load };
}
