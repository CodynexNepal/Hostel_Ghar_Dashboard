"use client";
import { useCallback, useEffect, useState } from "react";
import {
  hostelGhar,
  normalizeCheckLimit,
  normalizePlans,
  normalizeSubscriptionCurrent,
  normalizeSubscriptionHistory,
  normalizeSubscriptionRequests,
  resolveOwnerHostelId,
  validHostelId,
} from "@/lib/hostelGhar";
import { getHostelId, toApiError } from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import type {
  BackendPlan,
  SubscribePayload,
  SubscriptionCheckLimit,
  SubscriptionCurrent,
  SubscriptionHistoryItem,
  SubscriptionRequest,
  SubscriptionReviewAction,
} from "@/lib/api-types";
import type { SubscriptionPlan } from "@/types/auth";

/**
 * Live subscription state — GET /subscriptions/plans + /current +
 * /check-limit + /history. Hostel resolves explicit UUID → cookie →
 * first owned hostel; without one, current/check stay null and callers
 * render the "link a hostel" state (never a backend 400).
 */
export function useSubscription() {
  const { syncLiveSubscription } = useAuth();
  const [plans, setPlans] = useState<BackendPlan[]>([]);
  const [current, setCurrent] = useState<SubscriptionCurrent | null>(null);
  const [history, setHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [check, setCheck] = useState<SubscriptionCheckLimit | null>(null);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (preferred?: string | null) => {
      setIsLoading(true);
      setError(null);
      try {
        let p: BackendPlan[] = [];
        try {
          p = normalizePlans((await hostelGhar.subscriptions.plans()).data);
        } catch {
          p = [];
        }
        setPlans(p);

        const hid = await resolveOwnerHostelId(preferred ?? getHostelId());
        setHostelId(hid);
        const uuid = validHostelId(hid);

        let cur: SubscriptionCurrent | null = null;
        let chk: SubscriptionCheckLimit | null = null;
        if (uuid) {
          try {
            cur = normalizeSubscriptionCurrent((await hostelGhar.subscriptions.current(uuid)).data);
          } catch {
            cur = null;
          }
          try {
            chk = normalizeCheckLimit((await hostelGhar.subscriptions.checkLimit(uuid, 1)).data);
          } catch {
            chk = null;
          }
        }
        setCurrent(cur);
        setCheck(chk);

        try {
          setHistory(normalizeSubscriptionHistory((await hostelGhar.subscriptions.history()).data));
        } catch {
          setHistory([]);
        }

        // Mirror the LIVE plan into global auth state so plan-gated UI
        // matches the backend on every page (AuthProvider also fetches this).
        syncLiveSubscription(
          (cur?.subscription?.plan ?? chk?.currentPlan ?? "FREE") as SubscriptionPlan,
          cur?.limits?.residentCount ?? chk?.currentCount ?? 0,
          cur?.limits?.residentLimit ?? chk?.limit ?? null
        );
      } catch (e) {
        setError(toApiError(e).message);
      } finally {
        setIsLoading(false);
      }
    },
    [syncLiveSubscription]
  );

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const subscribe = useCallback(
    async (payload: SubscribePayload) => {
      const hid = validHostelId(payload.hostelId ?? hostelId);
      if (!hid) {
        setActionError("Link your account to a hostel first.");
        return false;
      }
      setIsMutating(true);
      setActionError(null);
      try {
        await hostelGhar.subscriptions.subscribe({ ...payload, hostelId: hid });
        await load(hid);
        return true;
      } catch (e) {
        setActionError(toApiError(e).message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [hostelId, load]
  );

  const cancel = useCallback(async () => {
    const hid = validHostelId(hostelId);
    if (!hid) {
      setActionError("Link your account to a hostel first.");
      return false;
    }
    setIsMutating(true);
    setActionError(null);
    try {
      await hostelGhar.subscriptions.cancel(hid);
      await load(hid);
      return true;
    } catch (e) {
      setActionError(toApiError(e).message);
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [hostelId, load]);

  const checkLimitFor = useCallback(
    async (count = 1) => {
      const hid = validHostelId(hostelId);
      if (!hid) return null;
      try {
        const r = normalizeCheckLimit((await hostelGhar.subscriptions.checkLimit(hid, count)).data);
        setCheck(r);
        return r;
      } catch (e) {
        setActionError(toApiError(e).message);
        return null;
      }
    },
    [hostelId]
  );

  const activePlan = current?.subscription?.plan ?? check?.currentPlan ?? "FREE";

  /**
   * The owner's plan-change request that is awaiting admin review (payment
   * proof uploaded). Derived from `/history` — a PENDING row means the plan
   * has NOT changed yet.
   */
  const pendingRequest = history.find((row) => row.status === "PENDING") ?? null;

  /** ADMIN ONLY: review queue of owner payment-proof requests. */
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const loadRequests = useCallback(async (status: string = "PENDING") => {
    setIsLoading(true);
    setError(null);
    try {
      const raw = await hostelGhar.subscriptions.requests({ status, limit: 100 });
      setRequests(normalizeSubscriptionRequests(raw.data));
    } catch (e) {
      setRequests([]);
      setError(toApiError(e).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** ADMIN ONLY: approve (activates) or reject a pending request. */
  const reviewRequest = useCallback(
    async (id: string, action: SubscriptionReviewAction, note?: string) => {
      setIsMutating(true);
      setActionError(null);
      try {
        await hostelGhar.subscriptions.reviewRequest(id, action, note);
        await loadRequests("PENDING");
        await load(hostelId);
        return true;
      } catch (e) {
        setActionError(toApiError(e).message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [hostelId, load, loadRequests]
  );

  return {
    plans,
    current,
    history,
    check,
    hostelId,
    isLoading,
    isMutating,
    error,
    actionError,
    activePlan,
    status: current?.subscription?.status ?? null,
    billingCycle: current?.subscription?.billingCycle ?? null,
    daysRemaining: current?.daysRemaining ?? null,
    residentLimit: current?.limits?.residentLimit ?? null,
    residentCount: current?.limits?.residentCount ?? check?.currentCount ?? 0,
    pendingRequest,
    requests,
    loadRequests,
    reviewRequest,
    reload: load,
    subscribe,
    cancel,
    checkLimitFor,
  };
}
