"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Fee, LeaveRequest, ResidentImport } from "@/lib/api-types";
import { hostelGhar, unwrap, toPaginated } from "@/lib/hostelGhar";
import { toApiError, type ApiErrorShape } from "@/lib/axios";

interface AsyncState<T> {
  data: T | null;
  error: ApiErrorShape | null;
  isLoading: boolean;
}

/** Owner dashboard summary (GET /owner/dashboard). */
export function useOwnerDashboard() {
  const [state, setState] = useState<AsyncState<Record<string, unknown>>>({
    data: null,
    error: null,
    isLoading: true,
  });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await hostelGhar.owner.dashboard();
      setState({
        data: unwrap(res.data) as Record<string, unknown>,
        error: null,
        isLoading: false,
      });
    } catch (err) {
      setState({ data: null, error: toApiError(err), isLoading: false });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load };
}

/** Hostel-scoped residents list. */
export function useHostelResidents(hostelId?: string) {
  const [state, setState] = useState<AsyncState<unknown[]>>({
    data: null,
    error: null,
    isLoading: Boolean(hostelId),
  });
  const load = useCallback(async () => {
    if (!hostelId) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await hostelGhar.hostels.residents(hostelId);
      setState({ data: toPaginated(res.data).items, error: null, isLoading: false });
    } catch (err) {
      setState({ data: null, error: toApiError(err), isLoading: false });
    }
  }, [hostelId]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load };
}

/** Hostel-scoped fee ledger. */
export function useHostelFees(hostelId?: string, status?: string) {
  const [state, setState] = useState<AsyncState<Fee[]>>({
    data: null,
    error: null,
    isLoading: Boolean(hostelId),
  });
  const load = useCallback(async () => {
    if (!hostelId) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await hostelGhar.fees.hostelFees(hostelId, status ? { status } : undefined);
      setState({ data: toPaginated<Fee>(res.data).items, error: null, isLoading: false });
    } catch (err) {
      setState({ data: null, error: toApiError(err), isLoading: false });
    }
  }, [hostelId, status]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load };
}

/** Resident's own fees. */
export function useResidentFees() {
  const [state, setState] = useState<AsyncState<Fee[]>>({
    data: null,
    error: null,
    isLoading: true,
  });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await hostelGhar.resident.fees();
      setState({ data: toPaginated<Fee>(res.data).items, error: null, isLoading: false });
    } catch (err) {
      setState({ data: null, error: toApiError(err), isLoading: false });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load };
}

/** Resident's own leave requests. */
export function useResidentLeaves() {
  const [state, setState] = useState<AsyncState<LeaveRequest[]>>({
    data: null,
    error: null,
    isLoading: true,
  });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await hostelGhar.resident.leaves();
      setState({ data: toPaginated<LeaveRequest>(res.data).items, error: null, isLoading: false });
    } catch (err) {
      setState({ data: null, error: toApiError(err), isLoading: false });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refetch: load };
}

/**
 * Resident bulk-import history (GET /owner/resident-imports).
 * Normalizes the backend's paginated shape `{ data, pagination }` and
 * polls active imports (QUEUED/PROCESSING) until they settle.
 */
export function useResidentImports(hostelId?: string | null, page = 1, limit = 20) {
  const [state, setState] = useState<AsyncState<ResidentImport[]>>({
    data: null,
    error: null,
    isLoading: Boolean(hostelId),
  });
  const [pagination, setPagination] = useState<{
    totalItems: number;
    currentPage: number;
    totalPages: number;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!hostelId) return;
    setState((s) => ({ ...s, isLoading: s.data === null, error: null }));
    try {
      const res = await hostelGhar.owner.residentImports({ hostelId, page, limit });
      const payload = unwrap<unknown>(res.data);
      const items = toPaginated<ResidentImport>(payload).items;
      // Backend paginated shape: { data: [], pagination: {...} }.
      const root = (payload ?? {}) as {
        pagination?: { totalItems?: number; currentPage?: number; totalPages?: number };
      };
      setPagination({
        totalItems: Number(root.pagination?.totalItems ?? items.length),
        currentPage: Number(root.pagination?.currentPage ?? page),
        totalPages: Number(root.pagination?.totalPages ?? 1),
      });
      setState({ data: items, error: null, isLoading: false });
      return items;
    } catch (err) {
      setState({ data: null, error: toApiError(err), isLoading: false });
      return null;
    }
  }, [hostelId, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any import is still running in the background worker.
  useEffect(() => {
    const active = (state.data ?? []).some(
      (i) => i.status === "QUEUED" || i.status === "PROCESSING"
    );
    if (!active) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      load();
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [state.data, load]);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    []
  );

  return { ...state, pagination, refetch: load };
}
