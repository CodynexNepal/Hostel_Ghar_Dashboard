"use client";

import { useCallback, useEffect, useState } from "react";
import { hostelGhar, normalizeSubscriptionRequests, toPaginated, unwrap } from "@/lib/hostelGhar";
import { toApiError } from "@/lib/axios";
import type { AdminSummary, SubscriptionRequest } from "@/lib/api-types";
import type { Hostel } from "@/types/hostel";
import type { AdminDashboardData } from "@/lib/admin-dashboard-types";

const INITIAL: AdminDashboardData = {
  summary: null,
  summaryError: null,
  hostels: [],
  hostelsError: null,
  pendingApprovals: [],
  pendingTotal: null,
  approvalsError: null,
  isLive: false,
};

/**
 * Admin-dashboard aggregator — calls ONLY endpoints confirmed live:
 *  - GET /analytics/admin/summary
 *  - GET /admin/hostels
 *  - GET /subscriptions/requests?status=PENDING&limit=5
 *
 * Failures are per-section (never block the page): missing backend
 * endpoints degrade to empty states + error text, and the dashboard
 * shows a "limited connectivity" banner instead of crashing.
 */
export function useAdminDashboard() {
  const [data, setData] = useState<AdminDashboardData>(INITIAL);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  const load = useCallback(async (isRetry = false) => {
    if (isRetry) setIsRefetching(true);
    else setIsLoading(true);
    try {
      const [summaryRes, hostelsRes, approvalsRes] = await Promise.allSettled([
        hostelGhar.analytics.adminSummary(),
        hostelGhar.admin.listHostels({ limit: 8 }),
        hostelGhar.subscriptions.requests({ status: "PENDING", limit: 5 }),
      ]);

      let summary: AdminSummary | null = null;
      let summaryError: string | null = null;
      if (summaryRes.status === "fulfilled") {
        try {
          summary = unwrap<AdminSummary>(summaryRes.value.data) ?? null;
        } catch (e) {
          summaryError = toApiError(e).message;
        }
      } else {
        summaryError = toApiError(summaryRes.reason).message;
      }

      let hostels: Hostel[] = [];
      let hostelsError: string | null = null;
      if (hostelsRes.status === "fulfilled") {
        try {
          hostels = toPaginated<Hostel>(hostelsRes.value.data).items;
        } catch (e) {
          hostelsError = toApiError(e).message;
        }
      } else {
        hostelsError = toApiError(hostelsRes.reason).message;
      }

      let pendingApprovals: SubscriptionRequest[] = [];
      let pendingTotal: number | null = null;
      let approvalsError: string | null = null;
      if (approvalsRes.status === "fulfilled") {
        try {
          pendingApprovals = normalizeSubscriptionRequests(approvalsRes.value.data);
          const meta = toPaginated<SubscriptionRequest>(approvalsRes.value.data).meta;
          pendingTotal = meta?.total ?? pendingApprovals.length;
        } catch (e) {
          approvalsError = toApiError(e).message;
        }
      } else {
        approvalsError = toApiError(approvalsRes.reason).message;
      }

      setData({
        summary,
        summaryError,
        hostels,
        hostelsError,
        pendingApprovals,
        pendingTotal,
        approvalsError,
        isLive: summary !== null,
      });
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return { ...data, isLoading, isRefetching, refetch: () => load(true) };
}
