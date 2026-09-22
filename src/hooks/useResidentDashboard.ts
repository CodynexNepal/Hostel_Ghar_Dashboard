"use client";
import { useCallback, useEffect, useState } from "react";
import type { Facility, Fee, HostelDetail, LeaveRequest, LeaveType } from "@/lib/api-types";
import { hostelGhar, normalizeFacility, toPaginated, unwrap } from "@/lib/hostelGhar";
import { getHostelId, toApiError, type ApiErrorShape } from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";

export interface ResidentRoomRow {
  id: string;
  fullName: string;
  email: string;
  hostelId: string;
  hostelName: string;
  hostel?: { id: string; name: string; type?: string; city?: string; address?: string } | null;
  roomNumber: string;
  bedNumber: string;
  roomType?: string;
  floor: number;
  flat: number;
  monthlyRent?: number;
  phone?: string;
}

export function normalizeResidentRoom(raw: unknown): ResidentRoomRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb = ""): string =>
    typeof v === "string" ? v : v === undefined || v === null ? fb : String(v);
  const num = (v: unknown, fb = 0): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : fb;
  };
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const hostelObj = (pick("hostel") ?? null) as ResidentRoomRow["hostel"];
  const floor = num(pick("floor", "flat", "floorNumber"), 0);
  const flatRaw = pick("flat");
  const flat = flatRaw !== undefined ? num(flatRaw, floor) : floor;
  return {
    id: str(pick("id", "_id", "residentId")),
    fullName: str(pick("fullName", "full_name", "name", "residentName")) || "Resident",
    email: str(pick("email", "residentEmail")),
    hostelId: str(pick("hostelId", "hostel_id") ?? (hostelObj as { id?: unknown } | null)?.id),
    hostelName:
      str(pick("hostelName", "hostel_name")) || str((hostelObj as { name?: unknown } | null)?.name),
    hostel: hostelObj,
    roomNumber: str(pick("roomNumber", "room_number", "roomNo", "room")),
    bedNumber: str(pick("bedNumber", "bed_number", "bedNo", "bed")),
    roomType: str(pick("roomType", "room_type", "type"), "") || undefined,
    floor,
    flat,
    monthlyRent: (() => {
      const v = pick("monthlyRent", "monthly_rent", "rent");
      if (v === undefined) return undefined;
      const n = num(v, NaN);
      return Number.isFinite(n) ? n : undefined;
    })(),
    phone: str(pick("phone", "phoneNumber"), "") || undefined,
  };
}

interface AsyncState<T> {
  data: T | null;
  error: ApiErrorShape | null;
  isLoading: boolean;
}

export function useResolvedHostelId() {
  const { user } = useAuth();
  const [hostelId, setHostelId] = useState<string | null>(user?.hostelId ?? getHostelId());
  const [isResolving, setIsResolving] = useState(!hostelId);
  useEffect(() => {
    const fromSession = user?.hostelId ?? getHostelId();
    if (fromSession) {
      setHostelId(fromSession);
      setIsResolving(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsResolving(true);
      try {
        const res = await hostelGhar.hostels.list({ limit: 1 });
        const items = toPaginated<HostelDetail>(res.data).items;
        if (!cancelled) setHostelId(items[0]?.id ?? null);
      } catch {
        if (!cancelled) setHostelId(null);
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.hostelId]);
  return { hostelId, isResolving };
}

export function useResidentHostel(hostelId?: string | null) {
  const [state, setState] = useState<AsyncState<HostelDetail>>({
    data: null,
    error: null,
    isLoading: Boolean(hostelId),
  });
  const load = useCallback(async () => {
    if (!hostelId) {
      setState({ data: null, error: null, isLoading: false });
      return null;
    }
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await hostelGhar.hostels.get(hostelId);
      const hostel = unwrap<HostelDetail>(res.data);
      setState({ data: hostel, error: null, isLoading: false });
      return hostel;
    } catch (err) {
      const error = toApiError(err);
      setState({ data: null, error, isLoading: false });
      return null;
    }
  }, [hostelId]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load, retry: load };
}
export function useHostelFacilities(hostelId?: string | null) {
  const [state, setState] = useState<AsyncState<Facility[]>>({
    data: null,
    error: null,
    isLoading: Boolean(hostelId),
  });
  const load = useCallback(async () => {
    if (!hostelId) {
      setState({ data: null, error: null, isLoading: false });
      return [];
    }
    setState((s) => ({ ...s, isLoading: s.data === null, error: null }));
    try {
      const res = await hostelGhar.facilities.listByHostel(hostelId);
      const items = toPaginated<unknown>(res.data).items.map(normalizeFacility);
      setState({ data: items, error: null, isLoading: false });
      return items;
    } catch (err) {
      const error = toApiError(err);
      setState({ data: null, error, isLoading: false });
      return [];
    }
  }, [hostelId]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load, retry: load };
}

export interface NormalizedLeaveType extends LeaveType {
  description?: string;
}

function normalizeLeaveType(raw: unknown): NormalizedLeaveType {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb = ""): string =>
    typeof v === "string" ? v : v === undefined || v === null ? fb : String(v);
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const maxRaw = pick("maxDays", "max_days", "maxLeaveDays", "allowedDays");
  const maxDays =
    typeof maxRaw === "number"
      ? maxRaw
      : typeof maxRaw === "string" && maxRaw.trim() !== ""
        ? Number(maxRaw)
        : undefined;
  return {
    id: str(pick("id", "_id", "leaveTypeId"), ""),
    name: str(pick("name", "title", "type"), "Leave"),
    hostelId: (pick("hostelId", "hostel_id") as string | undefined) ?? undefined,
    maxDays: typeof maxDays === "number" && Number.isFinite(maxDays) ? maxDays : undefined,
    description: str(pick("description", "details", "desc"), "") || undefined,
  };
}

export function useHostelLeaveTypes(hostelId?: string | null) {
  const [state, setState] = useState<AsyncState<NormalizedLeaveType[]>>({
    data: null,
    error: null,
    isLoading: Boolean(hostelId),
  });
  const load = useCallback(async () => {
    if (!hostelId) {
      setState({ data: null, error: null, isLoading: false });
      return [];
    }
    setState((s) => ({ ...s, isLoading: s.data === null, error: null }));
    try {
      const res = await hostelGhar.hostels.leaveTypes(hostelId);
      const items = toPaginated<unknown>(res.data).items.map(normalizeLeaveType);
      setState({ data: items, error: null, isLoading: false });
      return items;
    } catch (err) {
      const error = toApiError(err);
      setState({ data: null, error, isLoading: false });
      return [];
    }
  }, [hostelId]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load, retry: load };
}

export function useMyResidence(hostelId?: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<AsyncState<ResidentRoomRow | null> & { forbidden: boolean }>({
    data: null,
    error: null,
    isLoading: Boolean(hostelId),
    forbidden: false,
  });
  const load = useCallback(async () => {
    if (!hostelId) {
      setState({ data: null, error: null, isLoading: false, forbidden: false });
      return null;
    }
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await hostelGhar.hostels.residents(hostelId);
      const rows = toPaginated<unknown>(res.data).items.map(normalizeResidentRoom);
      const mine =
        rows.find(
          (rr) =>
            (user?.id && rr.id === user.id) ||
            (user?.email && rr.email.toLowerCase() === user.email.toLowerCase())
        ) ?? null;
      setState({ data: mine, error: null, isLoading: false, forbidden: false });
      return mine;
    } catch (err) {
      const error = toApiError(err);
      setState({ data: null, error, isLoading: false, forbidden: error.status === 403 });
      return null;
    }
  }, [hostelId, user?.id, user?.email]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load, retry: load };
}

export function useMyFees() {
  const [state, setState] = useState<AsyncState<Fee[]>>({
    data: null,
    error: null,
    isLoading: true,
  });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: s.data === null, error: null }));
    try {
      const res = await hostelGhar.resident.fees();
      const items = toPaginated<Fee>(res.data).items;
      setState({ data: items, error: null, isLoading: false });
      return items;
    } catch (err) {
      const error = toApiError(err);
      setState({ data: null, error, isLoading: false });
      return [];
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load, retry: load };
}

export function useMyLeaves() {
  const [state, setState] = useState<AsyncState<LeaveRequest[]>>({
    data: null,
    error: null,
    isLoading: true,
  });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: s.data === null, error: null }));
    try {
      const res = await hostelGhar.resident.leaves();
      const items = toPaginated<LeaveRequest>(res.data).items;
      setState({ data: items, error: null, isLoading: false });
      return items;
    } catch (err) {
      const error = toApiError(err);
      setState({ data: null, error, isLoading: false });
      return [];
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load, retry: load };
}
