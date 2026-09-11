import { PLAN_PERMISSIONS } from "@/constants/permissions";
import type { Permission, SubscriptionPlan, UserRole } from "@/types/auth";

/** Pure permission check — single source of truth for plan gating. */
export function hasPermission(plan: SubscriptionPlan, permission: Permission): boolean {
  return PLAN_PERMISSIONS[plan]?.includes(permission) ?? false;
}

export function canAccess(plan: SubscriptionPlan, required?: Permission): boolean {
  if (!required) return true;
  return hasPermission(plan, required);
}

/** Super admin bypasses plan checks; residents use their own nav (no plan gating). */
export function canRoleAccess(
  role: UserRole,
  plan: SubscriptionPlan,
  required?: Permission
): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (role === "RESIDENT") return true;
  return canAccess(plan, required);
}
