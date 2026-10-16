"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission, UserRole } from "@/types/auth";
import { homeRouteForRole } from "@/constants/navigation";
import { Skeleton } from "@/components/ui/Skeleton";

export function Protected({
  roles,
  permission,
  redirectTo,
  children,
}: {
  roles?: UserRole[];
  permission?: Permission;
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const { user, isLoading, role, subscriptionLoading } = useAuth();
  const { canAccess } = usePermissions();
  const router = useRouter();
  const roleOk = !roles || Boolean(role && roles.includes(role));
  // Don't redirect on a stale FREE plan while the live plan resolves.
  const planResolving = role === "HOSTEL_OWNER" && subscriptionLoading;
  const permOk = planResolving ? true : canAccess(permission);

  useEffect(() => {
    if (isLoading || planResolving) return;
    // Cookie-based auth: session lives in HttpOnly cookie + cached user.
    // No user (and revalidation failed) → login.
    if (!user) {
      router.replace("/login");
    } else if (!roleOk) {
      // Logged in but wrong role (e.g. resident opening owner/admin screens):
      // send them to their own dashboard, not the login page.
      router.replace(redirectTo ?? homeRouteForRole(user.role));
    } else if (!permOk) {
      router.replace(redirectTo ?? homeRouteForRole(user.role));
    }
  }, [isLoading, planResolving, user, roleOk, permOk, router, redirectTo]);

  if (isLoading || planResolving || !user || !roleOk || !permOk) {
    return (
      <div className="space-y-4" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
