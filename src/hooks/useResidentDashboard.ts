"use client";
import { useCallback, useEffect, useState } from "react";
import type { Facility, Fee, HostelDetail, LeaveRequest, LeaveType } from "@/lib/api-types";
import { hostelGhar, normalizeFacility, toPaginated, unwrap } from "@/lib/hostelGhar";
import {
  getHostelId,
  setHostelId as setHostelCookie,
  toApiError,
  type ApiErrorShape,
} from "@/lib/axios";
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
  joinedDate?: string;
  imageUrl?: string | null;
  fee?: unknown;
}

export function normalizeResidentRoom(raw: unknown): ResidentRoomRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb = ""): string =>
    typeof v === "string" ? v : v === undefined || v === null ? fb : String(v);
  const cleanEmail = (v: unknown): string => {
    const value = str(v);
    const markdownMatch = value.match(/\[([^\]]+)\]/);
    const email = markdownMatch?.[1] ?? value;
    return email
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .trim()
      .toLowerCase();
  };
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
  const roomObj = (pick("room") ?? null) as Record<string, unknown> | null;
  const userObj = (pick("user") ?? null) as Record<string, unknown> | null;
  const floor = num(pick("floor", "flat", "floorNumber") ?? roomObj?.floor ?? roomObj?.flat, 0);
  const flatRaw = pick("flat") ?? roomObj?.flat;
  const flat = flatRaw !== undefined ? num(flatRaw, floor) : floor;
  return {
    id: str(pick("id", "_id", "residentId")),
    fullName:
      str(pick("fullName", "full_name", "name", "residentName") ?? userObj?.name) || "Resident",
    email: cleanEmail(pick("email", "residentEmail") ?? userObj?.email),
    hostelId: str(pick("hostelId", "hostel_id") ?? (hostelObj as { id?: unknown } | null)?.id),
    hostelName:
      str(pick("hostelName", "hostel_name")) || str((hostelObj as { name?: unknown } | null)?.name),
    hostel: hostelObj,
    roomNumber: str(pick("roomNumber", "room_number", "roomNo", "room") ?? roomObj?.roomNumber),
    bedNumber: str(pick("bedNumber", "bed_number", "bedNo", "bed")),
    roomType: str(pick("roomType", "room_type", "type") ?? roomObj?.type, "") || undefined,
    floor,
    flat,
    monthlyRent: (() => {
      const v = pick("monthlyRent", "monthly_rent", "rent") ?? roomObj?.monthlyRent;
      if (v === undefined) return undefined;
      const n = num(v, NaN);
      return Number.isFinite(n) ? n : undefined;
    })(),
    phone: str(pick("phone", "phoneNumber") ?? userObj?.phone, "") || undefined,
    joinedDate: str(pick("joinedDate", "joined_date", "createdAt", "created_at"), "") || undefined,
    imageUrl:
      (pick("imageUrl", "image_url", "avatarUrl", "photoUrl") as string | null | undefined) ??
      (roomObj?.imageUrl as string | null | undefined) ??
      null,
    fee: pick("fee"),
  };
}

interface AsyncState<T> {
  data: T | null;
  error: ApiErrorShape | null;
  isLoading: boolean;
}

export function useResolvedHostelId() {
  const { user } = useAuth();
  const [hostelId, setHostelIdState] = useState<string | null>(() => {
    if (user?.role === "RESIDENT") {
      return user?.hostelId ?? null;
    }
    return user?.hostelId ?? getHostelId();
  });
  const [isResolving, setIsResolving] = useState(!hostelId);

  useEffect(() => {
    let cancelled = false;

    // For a RESIDENT: never resolve from arbitrary hostels or stale owner cookies.
    // Must come from user.hostelId or the authenticated resident's profile.
    if (user?.role === "RESIDENT") {
      if (user?.hostelId) {
        setHostelIdState(user.hostelId);
        setIsResolving(false);
        return;
      }
      setIsResolving(true);
      (async () => {
        try {
          const res = await hostelGhar.resident.me();
          const raw = unwrap<Record<string, unknown>>(res.data);
          const hostelObj = (raw?.hostel ?? {}) as Record<string, unknown>;
          const hid = (hostelObj.id as string) || (raw?.hostelId as string) || null;
          if (!cancelled) {
            setHostelIdState(hid);
            if (hid) setHostelCookie(hid);
          }
        } catch {
          if (!cancelled) setHostelIdState(null);
        } finally {
          if (!cancelled) setIsResolving(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    const fromSession = user?.hostelId ?? getHostelId();
    if (fromSession) {
      setHostelIdState(fromSession);
      setIsResolving(false);
      return;
    }
    setIsResolving(true);
    (async () => {
      try {
        const res = await hostelGhar.hostels.list({ limit: 1 });
        const items = toPaginated<HostelDetail>(res.data).items;
        if (!cancelled) setHostelIdState(items[0]?.id ?? null);
      } catch {
        if (!cancelled) setHostelIdState(null);
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.hostelId]);

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

/** Normalize backend leave-type shapes (snake/camel/_id variants). */
export function normalizeLeaveType(raw: unknown): NormalizedLeaveType {
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
  // Backend row from your DB: { id, hostelId/hostel_id, name, maxDays/max_days,
  // isActive/is_active/active }. Accept every variant so rows never vanish.
  const maxRaw = pick("maxDays", "max_days", "maxLeaveDays", "allowedDays", "max_days_allowed");
  const maxDays =
    typeof maxRaw === "number"
      ? maxRaw
      : typeof maxRaw === "string" && maxRaw.trim() !== ""
        ? Number(maxRaw)
        : undefined;
  const boolOf = (v: unknown): boolean | undefined => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(s)) return true;
      if (["false", "0", "no", "off", "inactive"].includes(s)) return false;
      return undefined;
    }
    if (typeof v === "number") return v !== 0;
    return undefined;
  };
  const activeRaw = pick("isActive", "is_active", "active", "isEnabled", "enabled");
  const isActive = boolOf(activeRaw);
  const requiresParentApproval = boolOf(
    pick(
      "requiresParentApproval",
      "requires_parent_approval",
      "parentApproval",
      "needsParentApproval"
    )
  );
  const createdAt = pick("createdAt", "created_at") as string | undefined;
  const updatedAt = pick("updatedAt", "updated_at") as string | undefined;
  return {
    id: str(pick("id", "_id", "leaveTypeId", "leave_type_id"), ""),
    name: str(pick("name", "title", "type", "leaveName", "leave_name"), "Leave"),
    hostelId: (pick("hostelId", "hostel_id", "hostelID") as string | undefined) ?? undefined,
    maxDays: typeof maxDays === "number" && Number.isFinite(maxDays) ? maxDays : undefined,
    isActive,
    requiresParentApproval,
    createdAt: typeof createdAt === "string" ? createdAt : undefined,
    updatedAt: typeof updatedAt === "string" ? updatedAt : undefined,
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
    isLoading: true,
    forbidden: false,
  });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    // 1. Primary: Use dedicated resident profile endpoint (works for all RESIDENT users)
    try {
      const res = await hostelGhar.resident.me();
      const raw = unwrap<unknown>(res.data);
      if (raw && typeof raw === "object") {
        const row = normalizeResidentRoom(raw);
        if (row.id || row.hostelId || row.roomNumber) {
          if (row.hostelId) {
            setHostelCookie(row.hostelId);
          }
          setState({ data: row, error: null, isLoading: false, forbidden: false });
          return row;
        }
      }
    } catch (meErr) {
      const error = toApiError(meErr);
      if (error.status === 401) {
        setState({ data: null, error, isLoading: false, forbidden: true });
        return null;
      }
    }

    // 2. Fallback: If hostelId is provided (e.g. owner previewing resident view)
    if (hostelId) {
      try {
        const res = await hostelGhar.hostels.residents(hostelId);
        const rows = toPaginated<unknown>(res.data).items.map(normalizeResidentRoom);
        const cleanEmail = (e?: string) =>
          (e ?? "")
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .trim()
            .toLowerCase();
        const mine =
          rows.find(
            (rr) =>
              (user?.id && rr.id === user.id) ||
              (user?.email && cleanEmail(rr.email) === cleanEmail(user.email))
          ) ?? (rows.length === 1 ? rows[0] : null);
        setState({ data: mine, error: null, isLoading: false, forbidden: false });
        return mine;
      } catch (err) {
        const error = toApiError(err);
        setState({ data: null, error, isLoading: false, forbidden: error.status === 403 });
        return null;
      }
    }

    setState({ data: null, error: null, isLoading: false, forbidden: false });
    return null;
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
  const [totalPendingDue, setTotalPendingDue] = useState<number | null>(null);
  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: s.data === null, error: null }));
    try {
      const res = await hostelGhar.resident.fees();
      // Backend shape: { success, fees: [...], totalPendingDue }
      // (NOT { data: [...] }) — pick up `fees` too via toPaginated.
      const items = toPaginated<Fee>(res.data).items;
      const raw = (res.data ?? {}) as { totalPendingDue?: unknown };
      const pending = raw.totalPendingDue !== undefined ? Number(raw.totalPendingDue) : null;
      setTotalPendingDue(Number.isFinite(pending as number) ? (pending as number) : null);
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
  return { ...state, totalPendingDue, refetch: load, retry: load };
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
