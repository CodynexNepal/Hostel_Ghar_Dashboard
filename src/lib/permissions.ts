import { PLAN_PERMISSIONS } from "@/constants/permissions";
import type { Permission, SubscriptionPlan, UserRole } from "@/types/auth";

/** Pure permission check — single source of truth for plan gating. */
export function hasPermission(plan: SubscriptionPlan, permission: Permission): boolean {
  const norm = (plan ? String(plan).trim().toUpperCase() : "FREE") as SubscriptionPlan;
  const list = PLAN_PERMISSIONS[norm] ?? PLAN_PERMISSIONS.FREE;
  return list.includes(permission);
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
  // Residents only see resident pages — never owner management screens or owner permissions.
  if (role === "RESIDENT") return false;
  return canAccess(plan, required);
}
