"use client";

import { useCallback, useEffect, useState } from "react";
import {
  hostelGhar,
  normalizeAdminSummary,
  normalizeHostelList,
  type AdminSummaryWithCounts,
} from "@/lib/hostelGhar";
import { toApiError, type ApiErrorShape } from "@/lib/axios";
import type { Hostel } from "@/types/hostel";

export interface AdminAnalyticsFilters {
  hostelId: string;
  range: "30d" | "3m" | "6m" | "1y";
}

interface AdminAnalyticsState {
  summary: AdminSummaryWithCounts | null;
  hostels: Hostel[];
  error: ApiErrorShape | null;
  summaryError: string | null;
  isLoading: boolean;
  isRefetching: boolean;
  filters: AdminAnalyticsFilters;
  setFilters: (f: Partial<AdminAnalyticsFilters>) => void;
  refetch: () => void;
  retry: () => void;
}

/**
 * Production admin-analytics data hook — live only, never modeled.
 * - GET /analytics/admin/summary  (platform totals, fee counts, revenueTrend, occupancy)
 * - GET /admin/hostels?limit=100  (per-hostel leaderboard rows)
 * Per-section failures degrade to empty states; the page never crashes.
 * Fee-ledger fan-out is intentionally NOT done here (N+1) — revenue detail
 * comes from summary.revenueTrend; the payments page owns ledger rows.
 */
export function useAdminAnalytics(): AdminAnalyticsState {
  const [summary, setSummary] = useState<AdminSummaryWithCounts | null>(null);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [filters, setFiltersState] = useState<AdminAnalyticsFilters>({
    hostelId: "all",
    range: "6m",
  });

  const setFilters = useCallback(
    (f: Partial<AdminAnalyticsFilters>) => setFiltersState((p) => ({ ...p, ...f })),
    []
  );

  const load = useCallback(async (isRetry = false) => {
    if (isRetry) setIsRefetching(true);
    else setIsLoading(true);
    setError(null);
    try {
      const [summaryRes, hostelsRes] = await Promise.allSettled([
        hostelGhar.analytics.adminSummary(),
        hostelGhar.admin.listHostels({ limit: 100 }),
      ]);

      let nextSummary: AdminSummaryWithCounts | null = null;
      if (summaryRes.status === "fulfilled") {
        try {
          nextSummary = normalizeAdminSummary(summaryRes.value.data) ?? null;
          setSummaryError(null);
        } catch (e) {
          setSummaryError(toApiError(e).message);
        }
      } else {
        setSummaryError(toApiError(summaryRes.reason).message);
      }
      setSummary(nextSummary);

      if (hostelsRes.status === "fulfilled") {
        try {
          setHostels(normalizeHostelList(hostelsRes.value.data));
        } catch (e) {
          setError(toApiError(e));
          setHostels([]);
        }
      } else {
        // Hostel leaderboard is enrichment — summary KPIs still render.
        // Only hard-fail when BOTH sources are down.
        if (nextSummary === null) setError(toApiError(hostelsRes.reason));
        setHostels([]);
      }
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return {
    summary,
    hostels,
    error,
    summaryError,
    isLoading,
    isRefetching,
    filters,
    setFilters,
    refetch: () => load(true),
    retry: () => load(false),
  };
}
