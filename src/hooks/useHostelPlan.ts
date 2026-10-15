"use client";
import { useCallback, useEffect, useState } from "react";
import {
  hostelGhar,
  normalizeSubscriptionCurrent,
  toPlanId,
  unwrap,
  validHostelId,
} from "@/lib/hostelGhar";
import type { SubscriptionPlan } from "@/types/auth";

/**
 * Read-only hostel plan — for residents who must NEVER see the
 * subscription management page. Resolves GET /subscriptions/current
 * for the resident's hostel and falls back to FREE on any failure.
 */
export function useHostelPlan(hostelId?: string | null) {
  const [plan, setPlan] = useState<SubscriptionPlan>("FREE");
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(hostelId));

  const load = useCallback(async (hid?: string | null) => {
    const uuid = validHostelId(hid ?? null);
    if (!uuid) {
      setPlan("FREE");
      setStatus(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    // 1) Live subscription endpoint (owner/admin scope — may 403 for residents).
    try {
      const cur = normalizeSubscriptionCurrent((await hostelGhar.subscriptions.current(uuid)).data);
      if (cur.subscription?.plan) {
        setPlan(cur.subscription.plan as SubscriptionPlan);
        setStatus(cur.subscription.status ?? null);
        setIsLoading(false);
        return;
      }
    } catch {
      /* 403/404 for residents — fall through to the hostel record */
    }

    // 2) Hostel detail (readable by residents) — some backends embed the plan.
    try {
      const detail = unwrap<Record<string, unknown>>((await hostelGhar.hostels.get(uuid)).data);
      const sub = (detail?.subscription ?? null) as Record<string, unknown> | null;
      const derived = toPlanId(
        detail?.subscriptionPlan ?? sub?.plan ?? detail?.plan ?? detail?.tier
      );
      if (derived) {
        setPlan(derived as SubscriptionPlan);
        const st = sub?.status ?? detail?.subscriptionStatus;
        setStatus(typeof st === "string" ? st : null);
        setIsLoading(false);
        return;
      }
    } catch {
      /* fall through */
    }

    setPlan("FREE");
    setStatus(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load(hostelId);
  }, [hostelId, load]);

  return { plan, status, isLoading, reload: () => load(hostelId) };
}
