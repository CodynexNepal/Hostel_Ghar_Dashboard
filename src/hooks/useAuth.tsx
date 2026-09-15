"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser, SubscriptionPlan, UserRole } from "@/types/auth";
import { hostelGhar, unwrap } from "@/lib/hostelGhar";
import { clearHostelId, clearToken, getToken, setToken, toApiError } from "@/lib/axios";
import type { ApiErrorShape } from "@/lib/axios";
import { USER_KEY } from "@/lib/env";
import { normalizeRole, roleFromToken, routeForRole } from "@/lib/jwt";
import { MOCK_OWNER_FREE } from "@/lib/mock-data";

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
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (p: Record<string, string>) => Promise<LoginResult>;
  logout: () => void;
  refresh: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  switchPlan: (plan: SubscriptionPlan) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

function normalizeUser(raw: unknown, fallback: UserRole): AuthUser {
  const u = (raw ?? {}) as Partial<AuthUser> & {
    hostel_id?: string;
    hostel?: string | { id?: string; _id?: string; hostelId?: string; name?: string };
    role?: unknown;
  };
  const hostel = typeof u.hostel === "object" ? u.hostel : undefined;
  const hostelId =
    u.hostelId ??
    u.hostel_id ??
    hostel?.id ??
    hostel?._id ??
    hostel?.hostelId ??
    (typeof u.hostel === "string" ? u.hostel : undefined);
  const hostelName = u.hostelName ?? hostel?.name;
  // Backend roles come in many shapes ("owner", "ROLE_OWNER", ["ADMIN"], …).
  // normalizeRole maps them onto our union; fall back only when unknown.
  const role = normalizeRole(u.role) ?? fallback;
  return {
    id: String(u.id ?? `u-${Date.now()}`),
    name: u.name ?? "Hostel User",
    email: u.email ?? "",
    phone: u.phone ?? "",
    role,
    avatarUrl: u.avatarUrl,
    hostelId,
    hostelName,
    subscription: u.subscription ?? {
      plan: role === "SUPER_ADMIN" ? "ENTERPRISE" : "FREE",
      status: "ACTIVE",
      residentsUsed: 0,
      residentsLimit: role === "SUPER_ADMIN" ? 100000 : 10,
      renewsAt: "",
      startedAt: "",
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
        redirectTo = routeForRole(normalized.role);
        setPlanOverride(null);
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

  const logout = useCallback(() => {
    clearToken();
    clearHostelId();
    writeCachedUser(null);
    setUser(null);
    setPlanOverride(null);
    setAuthError(null);
    if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const switchRole = useCallback((r: UserRole) => {
    if (process.env.NODE_ENV === "production") return;
    const demo: AuthUser =
      r === "RESIDENT"
        ? {
            id: "u-res-1",
            name: "Ramesh Adhikari",
            email: "ramesh@mail.com",
            phone: "9841111111",
            role: "RESIDENT",
            hostelId: "h-1",
            hostelName: "Sunrise Boys Hostel",
            subscription: { ...MOCK_OWNER_FREE.subscription, plan: "FREE" },
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
                residentsUsed: 1240,
                residentsLimit: 100000,
                renewsAt: "2027-01-01",
                startedAt: "2025-01-01",
              },
            }
          : { ...MOCK_OWNER_FREE, subscription: { ...MOCK_OWNER_FREE.subscription } };
    setUser(demo);
    writeCachedUser(demo);
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
          residentsLimit: p === "FREE" ? 10 : p === "BASIC" ? 60 : 500,
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
      // Backend is cookie-based (HttpOnly session cookie, withCredentials).
      // A local Bearer token is optional/legacy — presence of `user` is the session signal.
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refresh,
      switchRole,
      switchPlan,
    }),
    [
      user,
      isLoading,
      isAuthenticating,
      authError,
      role,
      plan,
      login,
      register,
      logout,
      refresh,
      switchRole,
      switchPlan,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
