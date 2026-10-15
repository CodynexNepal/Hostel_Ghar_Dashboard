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

export function canRoleAccess(
  role: UserRole,
  plan: SubscriptionPlan,
  required?: Permission
): boolean {
  if (role === "SUPER_ADMIN") return true;
  // Residents only see their own pages — never owner management screens
  // like /subscription (MANAGE_SUBSCRIPTION). The hostel plan badge is
  // the only subscription surface they get.
  if (role === "RESIDENT") return required !== "MANAGE_SUBSCRIPTION";
  return canAccess(plan, required);
}
