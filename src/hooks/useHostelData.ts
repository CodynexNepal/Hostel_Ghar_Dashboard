"use client";

import { useCallback, useEffect, useState } from "react";
import type { Fee, LeaveRequest } from "@/lib/api-types";
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
