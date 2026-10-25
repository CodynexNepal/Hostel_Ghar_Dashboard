"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { AuthUser, SubscriptionPlan, UserRole } from "@/types/auth";
import {
  hostelGhar,
  normalizeCheckLimit,
  normalizeSubscriptionCurrent,
  normalizeSubscriptionHistory,
  resolveOwnerHostelId,
  toPlanId,
  unwrap,
  validHostelId,
} from "@/lib/hostelGhar";
import {
  clearHostelId,
  clearRoleCookie,
  clearSessionCookie,
  clearToken,
  getHostelId,
  getToken,
  setRoleCookie,
  setSessionCookie,
  setToken,
  toApiError,
} from "@/lib/axios";
import type { ApiErrorShape } from "@/lib/axios";
import { USER_KEY } from "@/lib/env";
import { normalizeRole, roleFromToken, routeForRole } from "@/lib/jwt";

export interface LoginResult {
  ok: boolean;
  /** Where the caller should navigate on success (role home). Null on failure. */
  redirectTo: string | null;
  error?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  authError: ApiErrorShape | null;
  role: UserRole | null;
  plan: SubscriptionPlan;
  /** True while the owner's live plan is being fetched — gates should wait, not lock. */
  subscriptionLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (p: Record<string, string>) => Promise<LoginResult>;
  /** Open the "Are you sure?" logout confirmation (real logout happens on confirm). */
  requestLogout: () => void;
  logout: () => Promise<void>;
  /** Confirmed logout — hits POST /auth/logout then wipes local session. */
  confirmLogout: (logoutAll?: boolean) => Promise<void>;
  isLoggingOut: boolean;
  logoutModalOpen: boolean;
  closeLogoutModal: () => void;
  logoutError: string | null;
  refresh: () => Promise<void>;
  /** Re-fetch live plan for current owner (no-op for other roles). */
  refreshSubscription: (explicitUser?: AuthUser | null) => Promise<void>;
  switchRole: (role: UserRole) => void;
  switchPlan: (plan: SubscriptionPlan) => void;
  syncLiveSubscription: (planId: SubscriptionPlan, used: number, limit: number | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedUser(): AuthUser | null {
  // Fast-path so a logged-in user sees the dashboard instantly after login
  // navigation, while the background /auth/me revalidation confirms it.
  // Without this, every full page load starts as logged-out, Protected
  // redirects to /login, and the middleware bounces back — the "dashboard
  // not opening after successful login" loop.
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && typeof parsed === "object" && parsed.role && parsed.email) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null) {
  // Keep the cached user in sync so reloads restore the session instantly.
  if (typeof window === "undefined") return;
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    /* storage blocked — backend stays source of truth */
  }
}

function normalizeUser(raw: unknown, fallback: UserRole): AuthUser {
  const u = (raw ?? {}) as Partial<AuthUser> & {
    hostel_id?: string;
    hostel?: string | { id?: string; _id?: string; hostelId?: string; name?: string };
    role?: unknown;
    // Backend user shapes vary: { name } vs { firstName, lastName } vs
    // { fullName } vs nested { user: {...} }.
    firstName?: unknown;
    first_name?: unknown;
    lastName?: unknown;
    last_name?: unknown;
    fullName?: unknown;
    full_name?: unknown;
    ownerName?: unknown;
    owner_name?: unknown;
    displayName?: unknown;
    username?: unknown;
    user?: unknown;
    _id?: unknown;
    id?: unknown;
  };
  const nested =
    u.user !== null && typeof u.user === "object" ? (u.user as Record<string, unknown>) : null;
  const str = (v: unknown): string | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t ? t : undefined;
  };
  const first = str(u.firstName ?? u.first_name ?? nested?.firstName ?? nested?.first_name) ?? "";
  const last = str(u.lastName ?? u.last_name ?? nested?.lastName ?? nested?.last_name) ?? "";
  const composed = `${first} ${last}`.trim();
  const backendName =
    str(u.name) ??
    str(nested?.name) ??
    str(u.fullName ?? u.full_name ?? nested?.fullName ?? nested?.full_name) ??
    str(u.ownerName ?? u.owner_name ?? nested?.ownerName) ??
    str(u.displayName ?? nested?.displayName) ??
    (composed ? composed : undefined) ??
    str(u.username ?? nested?.username);
  const email = str(u.email ?? nested?.email) ?? "";
  // Never render the "Hostel User" placeholder when we know the email —
  // fall back to the email prefix (dinesh.tamang1519@gmail.com → Dinesh Tamang1519).
  const emailPrefix = email.split("@")[0] ?? "";
  const prettyFromEmail = emailPrefix
    ? emailPrefix
        .split(/[._-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ")
    : undefined;
  const name = backendName ?? prettyFromEmail ?? "Hostel User";
  const hostel = typeof u.hostel === "object" ? u.hostel : undefined;
  const hostelId =
    u.hostelId ??
    u.hostel_id ??
    hostel?.id ??
    hostel?._id ??
    hostel?.hostelId ??
    (typeof u.hostel === "string" ? u.hostel : undefined) ??
    str(nested?.hostelId ?? nested?.hostel_id);
  const hostelName = u.hostelName ?? hostel?.name ?? str(nested?.hostelName);
  // Backend roles come in many shapes ("owner", "ROLE_OWNER", ["ADMIN"], …).
  // normalizeRole maps them onto our union; fall back only when unknown.
  const role = normalizeRole(u.role ?? nested?.role) ?? fallback;
  // Normalize the embedded subscription too — backend may send
  // `{ plan: "PRO", residentsLimit: null }` for unlimited.
  const rawSub = (u.subscription ?? nested?.subscription) as
    Partial<AuthUser["subscription"]> | undefined;
  const subPlan = (typeof rawSub?.plan === "string" ? rawSub.plan.toUpperCase() : undefined) as
    AuthUser["subscription"]["plan"] | undefined;
  const normLimit = (v: unknown): number | null | undefined => {
    if (v === undefined || v === "") return undefined;
    if (v === null) return null;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    id: String(u.id ?? u._id ?? nested?.id ?? nested?._id ?? `u-${Date.now()}`),
    name,
    email,
    phone: str((u as { phone?: unknown }).phone ?? nested?.phone) ?? "",
    role,
    avatarUrl: u.avatarUrl ?? (str(nested?.avatarUrl) as string | undefined),
    hostelId,
    hostelName,
    subscription: {
      plan: subPlan ?? (role === "SUPER_ADMIN" ? "ENTERPRISE" : "FREE"),
      status: (rawSub?.status as AuthUser["subscription"]["status"]) ?? "ACTIVE",
      residentsUsed: Number(rawSub?.residentsUsed ?? 0) || 0,
      // PRO/ENTERPRISE = null (unlimited). FREE=10 — never invent 500.
      residentsLimit:
        normLimit(rawSub?.residentsLimit) ??
        (role === "SUPER_ADMIN"
          ? 100000
          : subPlan === "PRO" || subPlan === "ENTERPRISE"
            ? null
            : 10),
      renewsAt: rawSub?.renewsAt ?? "",
      startedAt: rawSub?.startedAt ?? "",
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [planOverride, setPlanOverride] = useState<SubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<ApiErrorShape | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const isLoggingOutRef = useRef(false);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /**
   * Write the LIVE plan into auth state. Must run in ALL environments
   * (incl. production) — previously this only happened on /subscription.
   */
  const syncLiveSubscription = useCallback(
    (planId: SubscriptionPlan, used: number, limit: number | null) => {
      setPlanOverride(planId);
      setUser((prev) => {
        if (!prev) return prev;
        const next: AuthUser = {
          ...prev,
          subscription: {
            ...prev.subscription,
            plan: prev.role === "SUPER_ADMIN" ? "ENTERPRISE" : planId,
            residentsUsed: used,
            // null = unlimited (PRO/ENTERPRISE). Never fall back to 500 —
            // that is what rendered "5/500" for an unlimited plan.
            residentsLimit: limit,
          },
        };
        writeCachedUser(next);
        return next;
      });
    },
    []
  );

  /**
   * Fetch the owner's REAL plan (GET current + check-limit) and sync it.
   * Hostel resolves explicit UUID → cookie → first owned hostel.
   */
  const refreshSubscription = useCallback(
    async (explicitUser?: AuthUser | null) => {
      const snapshot = explicitUser ?? userRef.current;
      if (!snapshot || snapshot.role !== "HOSTEL_OWNER") return;
      let hid: string | null = null;
      try {
        hid = await resolveOwnerHostelId(snapshot.hostelId ?? getHostelId());
      } catch {
        hid = null;
      }
      const uuid = validHostelId(hid);
      if (!uuid) return;
      setSubscriptionLoading(true);
      try {
        let plan: SubscriptionPlan = "FREE";
        let used = 0;
        let limit: number | null = 10;
        try {
          const cur = normalizeSubscriptionCurrent(
            (await hostelGhar.subscriptions.current(uuid)).data
          );
          plan = (cur?.subscription?.plan ?? "FREE") as SubscriptionPlan;
          used = cur?.limits?.residentCount ?? 0;
          limit = cur?.limits?.residentLimit ?? null;
          try {
            const chk = normalizeCheckLimit(
              (await hostelGhar.subscriptions.checkLimit(uuid, 1)).data
            );
            if (!cur?.subscription) plan = (chk?.currentPlan ?? "FREE") as SubscriptionPlan;
            used = chk?.currentCount ?? used;
            if (limit == null) limit = chk?.limit ?? null;
          } catch {
            /* keep current values */
          }
        } catch {
          try {
            const chk = normalizeCheckLimit(
              (await hostelGhar.subscriptions.checkLimit(uuid, 1)).data
            );
            plan = (chk?.currentPlan ?? "FREE") as SubscriptionPlan;
            used = chk?.currentCount ?? 0;
            limit = chk?.limit ?? null;
          } catch {
            /* FREE fallback */
          }
        }
        syncLiveSubscription(plan, used, limit);
      } finally {
        setSubscriptionLoading(false);
      }
    },
    [syncLiveSubscription]
  );

  // Auto-load live plan whenever the owner session resolves — this is the
  // fix for "lock everywhere until I manually visit /subscription".
  useEffect(() => {
    if (isLoading || !user || user.role !== "HOSTEL_OWNER") return;
    refreshSubscription().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user?.id, user?.role, user?.hostelId]);

  useEffect(() => {
    const cached = readCachedUser();
    // Cookie-based sessions have no local token (backend sets HttpOnly cookies).
    // Restore cached user either way; if no cache, try silent /auth/me revalidation.
    if (cached) {
      setUser(cached);
      setIsLoading(false);
      // Revalidate in background so stale role/plan self-heals without blocking UI.
      hostelGhar.auth
        .me()
        .then((profile) => {
          const rawUser = unwrap(profile.data);
          if (!rawUser) return;
          const normalized = normalizeUser(rawUser, cached.role);
          setUser(normalized);
          writeCachedUser(normalized);
          setRoleCookie(normalized.role);
          setSessionCookie();
        })
        .catch(() => {
          /* offline or session expired — keep cached user, 401 interceptor redirects */
        });
    } else {
      hostelGhar.auth
        .me()
        .then((profile) => {
          const rawUser = unwrap(profile.data);
          if (!rawUser) return;
          const tokenRole = roleFromToken(getToken());
          const normalized = normalizeUser(rawUser, tokenRole ?? "HOSTEL_OWNER");
          setUser(normalized);
          writeCachedUser(normalized);
          setRoleCookie(normalized.role);
          setSessionCookie();
        })
        .catch(() => {
          /* no session — user stays null and guards redirect to /login */
        })
        .finally(() => setIsLoading(false));
    }
  }, []);

  const role = user?.role ?? null;
  const plan: SubscriptionPlan = useMemo(() => {
    if (!user) return "FREE";
    if (planOverride) return user.role === "SUPER_ADMIN" ? "ENTERPRISE" : planOverride;
    return user.subscription.plan;
  }, [user, planOverride]);

  const refresh = useCallback(async () => {
    try {
      const currentRole = readCachedUser()?.role ?? role;
      if (currentRole === "RESIDENT") await hostelGhar.resident.fees();
      else if (currentRole === "HOSTEL_OWNER") await hostelGhar.owner.dashboard();
      else if (currentRole === "SUPER_ADMIN") await hostelGhar.analytics.adminSummary();
    } catch {
      /* 401 handled globally */
    }
  }, [role]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsAuthenticating(true);
      setAuthError(null);
      try {
        const res = await hostelGhar.auth.login({ email, password });
        // Backend is cookie-based: it sets HttpOnly access/refresh cookies and
        // returns only `{ message }`. It NEVER returns a token in the body —
        // so do NOT require one. The session cookie is the credential.
        // (Legacy Bearer-token bodies are still accepted if present.)
        const body = res.data as unknown as {
          token?: string;
          accessToken?: string;
          user?: unknown;
          data?: { user?: unknown } | unknown;
        };
        const token = body?.token ?? body?.accessToken;
        let rawUser =
          body?.user ??
          (body?.data && typeof body.data === "object" && "user" in body.data
            ? body.data.user
            : undefined);
        if (token) setToken(token);
        else clearToken();
        const tokenRole = roleFromToken(token);
        if (!rawUser && !tokenRole) {
          try {
            const profile = await hostelGhar.auth.me();
            rawUser = unwrap(profile.data);
          } catch {
            throw new Error("Login succeeded, but the server did not return the user role.");
          }
        }
        let redirectTo = "/dashboard";
        const normalized = normalizeUser(rawUser ?? { email }, tokenRole ?? "HOSTEL_OWNER");
        if (!rawUser && !tokenRole) {
          throw new Error("The server profile did not include a supported user role.");
        }
        setUser(normalized);
        writeCachedUser(normalized);
        setRoleCookie(normalized.role);
        setSessionCookie();
        redirectTo = routeForRole(normalized.role);
        setPlanOverride(null);
        // Fetch the REAL plan immediately so the landing page never gates on
        // the stale cached FREE plan (no need to visit /subscription first).
        refreshSubscription(normalized).catch(() => undefined);
        router.push(redirectTo);
        return {
          ok: true,
          redirectTo,
        };
      } catch (err) {
        setAuthError(toApiError(err));
        return { ok: false, redirectTo: null, error: toApiError(err).message };
      } finally {
        setIsAuthenticating(false);
      }
    },
    [router, refreshSubscription]
  );

  const register = useCallback(
    async (p: Record<string, string>) => {
      setIsAuthenticating(true);
      setAuthError(null);
      try {
        const res = await hostelGhar.auth.register({
          name: p.name,
          email: p.email,
          phone: p.phone,
          password: p.password,
          hostelName: p.hostelName,
        });
        const body = res.data as unknown as { token?: string; user?: unknown };
        const token = body?.token;
        const rawUser = body?.user;
        let redirectTo = "/login?registered=1";
        if (token) {
          setToken(token);
          const normalized = normalizeUser(rawUser, "HOSTEL_OWNER");
          setUser(normalized);
          writeCachedUser(normalized);
          setRoleCookie(normalized.role);
          setSessionCookie();
          redirectTo = routeForRole(normalized.role);
        }
        router.push(redirectTo);
        return {
          ok: true,
          redirectTo,
        };
      } catch (err) {
        setAuthError(toApiError(err));
        return { ok: false, redirectTo: null, error: toApiError(err).message };
      } finally {
        setIsAuthenticating(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    // Backwards-compat alias — opens the confirmation modal.
    setLogoutModalOpen(true);
  }, []);

  const requestLogout = useCallback(() => {
    setLogoutError(null);
    setLogoutModalOpen(true);
  }, []);

  const closeLogoutModal = useCallback(() => {
    if (isLoggingOutRef.current) return;
    setLogoutModalOpen(false);
    setLogoutError(null);
  }, []);

  const wipeLocalSession = useCallback(() => {
    clearToken();
    clearHostelId();
    clearRoleCookie();
    clearSessionCookie();
    writeCachedUser(null);
    setUser(null);
    setPlanOverride(null);
    setAuthError(null);
  }, []);

  const confirmLogout = useCallback(
    async (logoutAll = false) => {
      // Prevent double-taps firing parallel logouts.
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      setIsLoggingOut(true);
      setLogoutError(null);
      try {
        // POST /auth/logout is idempotent by contract (works with NO token,
        // an EXPIRED token, or a valid token — never 401s just to log out).
        // Teardown happens server-side: token denylist, refresh-hash null,
        // cache purge, socket kill, cookie clear. We never let a failure
        // trap the user logged in — local session is wiped regardless.
        try {
          if (logoutAll) {
            try {
              await hostelGhar.auth.logoutAll();
            } catch {
              await hostelGhar.auth.logout(true);
            }
          } else {
            await hostelGhar.auth.logout(false);
          }
        } catch (err) {
          // Network down / backend unreachable: still log out locally.
          // Only surface the error when it's NOT a plain network failure
          // so the user knows cookies/tokens may still be alive server-side.
          const apiErr = toApiError(err);
          if (apiErr.status !== 0) setLogoutError(apiErr.message);
        }
      } finally {
        wipeLocalSession();
        isLoggingOutRef.current = false;
        setIsLoggingOut(false);
        setLogoutModalOpen(false);
        if (typeof window !== "undefined") {
          // Hard navigation guarantees no stale in-memory state survives.
          window.location.href = logoutAll ? "/login?reason=logged-out-all" : "/login";
        }
      }
    },
    [wipeLocalSession]
  );

  const switchRole = useCallback((r: UserRole) => {
    if (process.env.NODE_ENV === "production") return;
    const defaultOwnerSubscription = {
      plan: "FREE" as const,
      status: "ACTIVE" as const,
      residentsUsed: 0,
      residentsLimit: 10,
      renewsAt: "2026-10-01",
      startedAt: "2026-06-01",
    };
    const demo: AuthUser =
      r === "RESIDENT"
        ? {
            id: "u-res-1",
            name: "Resident User",
            email: "resident@hostelghar.com",
            phone: "9800000000",
            role: "RESIDENT",
            hostelId: "h-1",
            hostelName: "Hostel Ghar",
            subscription: defaultOwnerSubscription,
          }
        : r === "SUPER_ADMIN"
          ? {
              id: "u-super-1",
              name: "Platform Admin",
              email: "admin@hostelghar.com",
              phone: "9800000000",
              role: "SUPER_ADMIN",
              subscription: {
                plan: "ENTERPRISE",
                status: "ACTIVE",
                residentsUsed: 0,
                residentsLimit: 100000,
                renewsAt: "2027-01-01",
                startedAt: "2025-01-01",
              },
            }
          : {
              id: "u-owner-1",
              name: "Hostel Owner",
              email: "owner@hostelghar.com",
              phone: "9800000000",
              role: "HOSTEL_OWNER",
              hostelId: "h-1",
              hostelName: "Hostel Ghar",
              subscription: defaultOwnerSubscription,
            };
    setUser(demo);
    writeCachedUser(demo);
    setRoleCookie(demo.role);
    setSessionCookie();
    if (!getToken()) {
      try {
        setToken("demo-token");
      } catch {
        /* noop */
      }
    }
  }, []);

  const switchPlan = useCallback((p: SubscriptionPlan) => {
    if (process.env.NODE_ENV === "production") return;
    setPlanOverride(p);
    setUser((prev) => {
      if (!prev) return prev;
      const next: AuthUser = {
        ...prev,
        subscription: {
          ...prev.subscription,
          plan: prev.role === "SUPER_ADMIN" ? "ENTERPRISE" : p,
          // PRO / ENTERPRISE = null (unlimited) — must match PLANS + backend.
          residentsLimit:
            p === "FREE" ? 10 : p === "BASIC" ? 60 : p === "PRO" || p === "ENTERPRISE" ? null : 10,
        },
      };
      writeCachedUser(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticating,
      authError,
      role,
      plan,
      subscriptionLoading,
      // Backend is cookie-based (HttpOnly session cookie, withCredentials).
      // A local Bearer token is optional/legacy — presence of `user` is the session signal.
      isAuthenticated: Boolean(user),
      login,
      register,
      requestLogout,
      logout,
      confirmLogout,
      isLoggingOut,
      logoutModalOpen,
      closeLogoutModal,
      logoutError,
      refresh,
      refreshSubscription,
      switchRole,
      switchPlan,
      syncLiveSubscription,
    }),
    [
      user,
      isLoading,
      isAuthenticating,
      authError,
      role,
      plan,
      subscriptionLoading,
      login,
      register,
      requestLogout,
      logout,
      confirmLogout,
      isLoggingOut,
      logoutModalOpen,
      closeLogoutModal,
      logoutError,
      refresh,
      refreshSubscription,
      switchRole,
      switchPlan,
      syncLiveSubscription,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
