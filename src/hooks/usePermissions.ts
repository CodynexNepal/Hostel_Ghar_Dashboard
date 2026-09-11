"use client";

import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { hasPermission } from "@/lib/permissions";
import type { Permission } from "@/types/auth";

export function usePermissions() {
  const { plan, role } = useAuth();

  return useMemo(
    () => ({
      plan,
      role,
      has: (permission: Permission) => {
        if (role === "SUPER_ADMIN" || role === "RESIDENT") return true;
        return hasPermission(plan, permission);
      },
      canAccess: (permission?: Permission) => {
        if (!permission) return true;
        if (role === "SUPER_ADMIN" || role === "RESIDENT") return true;
        return hasPermission(plan, permission);
      },
    }),
    [plan, role]
  );
}
