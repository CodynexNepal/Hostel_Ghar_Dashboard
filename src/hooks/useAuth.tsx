"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, SubscriptionPlan, UserRole } from "@/types/auth";
import { MOCK_OWNER_FREE } from "@/lib/mock-data";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  role: UserRole | null;
  plan: SubscriptionPlan;
  switchRole: (role: UserRole) => void;
  switchPlan: (plan: SubscriptionPlan) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userForRole(role: UserRole, plan: SubscriptionPlan): AuthUser {
  if (role === "RESIDENT") {
    return {
      id: "u-res-1",
      name: "Ramesh Adhikari",
      email: "ramesh@mail.com",
      phone: "9841111111",
      role: "RESIDENT",
      hostelId: "h-1",
      hostelName: "Sunrise Boys Hostel",
      subscription: { ...MOCK_OWNER_FREE.subscription, plan: "FREE" },
    };
  }
  if (role === "SUPER_ADMIN") {
    return {
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
    };
  }
  return {
    ...MOCK_OWNER_FREE,
    subscription: {
      ...MOCK_OWNER_FREE.subscription,
      plan,
      residentsLimit: plan === "FREE" ? 10 : plan === "BASIC" ? 60 : 500,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("HOSTEL_OWNER");
  const [plan, setPlan] = useState<SubscriptionPlan>("FREE");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const switchRole = useCallback((r: UserRole) => {
    setRole(r);
    if (r === "SUPER_ADMIN") setPlan("ENTERPRISE");
    if (r === "RESIDENT") setPlan("FREE");
  }, []);

  const switchPlan = useCallback((p: SubscriptionPlan) => setPlan(p), []);
  const logout = useCallback(() => {
    window.localStorage.removeItem("hg_token");
    window.location.href = "/login";
  }, []);

  const user = useMemo(() => userForRole(role, plan), [role, plan]);

  const value = useMemo(
    () => ({ user, isLoading, role, plan, switchRole, switchPlan, logout }),
    [user, isLoading, role, plan, switchRole, switchPlan, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
