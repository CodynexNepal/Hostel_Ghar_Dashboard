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
  const { user, syncLiveSubscription } = useAuth();
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

        const candidateHostel = preferred ?? user?.hostelId ?? getHostelId();
        const hid = await resolveOwnerHostelId(candidateHostel);
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

        // Direct query fallback: hit GET /subscriptions/current without hostelId
        if (!cur?.subscription || cur.subscription.plan === "FREE") {
          try {
            const direct = normalizeSubscriptionCurrent(
              (await hostelGhar.subscriptions.current()).data
            );
            if (direct?.subscription && direct.subscription.plan !== "FREE") {
              cur = direct;
            } else if (!cur) {
              cur = direct;
            }
          } catch {
            /* ignore direct query error */
          }
        }

        let hist: SubscriptionHistoryItem[] = [];
        try {
          hist = normalizeSubscriptionHistory((await hostelGhar.subscriptions.history()).data);
          setHistory(hist);
        } catch {
          hist = [];
          setHistory([]);
        }

        // Live backend history verification: if history has an ACTIVE paid plan, use it
        const activePaidHist = hist.find(
          (h) => h.status === "ACTIVE" && h.plan && h.plan !== "FREE"
        );
        if ((!cur?.subscription || cur.subscription.plan === "FREE") && activePaidHist?.plan) {
          cur = {
            ...(cur ?? { plan: null, limits: null, daysRemaining: null }),
            subscription: {
              id: activePaidHist.id,
              plan: activePaidHist.plan,
              status: "ACTIVE",
              billingCycle: activePaidHist.billingCycle ?? "MONTHLY",
              price: activePaidHist.price,
              currency: activePaidHist.currency,
              startDate: activePaidHist.startDate,
              endDate: activePaidHist.endDate,
            },
          };
        }

        setCurrent(cur);
        setCheck(chk);

        // Derive plan with priority to backend paid active plan
        const derivedPlan = (cur?.subscription?.plan ??
          chk?.currentPlan ??
          activePaidHist?.plan ??
          user?.subscription.plan ??
          "FREE") as SubscriptionPlan;
        const derivedUsed =
          cur?.limits?.residentCount ?? chk?.currentCount ?? user?.subscription.residentsUsed ?? 0;
        const derivedLimit =
          cur?.limits?.residentLimit ??
          chk?.limit ??
          (derivedPlan === "PRO" || derivedPlan === "ENTERPRISE" ? null : 10);

        // Mirror the LIVE plan into global auth state so plan-gated UI matches backend everywhere
        syncLiveSubscription(derivedPlan, derivedUsed, derivedLimit);
      } catch (e) {
        setError(toApiError(e).message);
      } finally {
        setIsLoading(false);
      }
    },
    [
      syncLiveSubscription,
      user?.hostelId,
      user?.subscription.plan,
      user?.subscription.residentsUsed,
    ]
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
