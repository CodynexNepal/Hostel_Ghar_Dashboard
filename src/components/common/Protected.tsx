"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission, UserRole } from "@/types/auth";
import { homeRouteForRole } from "@/constants/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { clearRoleCookie, clearSessionCookie, clearToken } from "@/lib/axios";

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
  const pathname = usePathname();
  const roleOk = !roles || Boolean(role && roles.includes(role));
  // Don't redirect on a stale FREE plan while the live plan resolves.
  const planResolving = role === "HOSTEL_OWNER" && subscriptionLoading;
  const permOk = planResolving ? true : canAccess(permission);

  useEffect(() => {
    if (isLoading || planResolving) return;

    if (!user) {
      // Clear session cookies so middleware doesn't bounce /login back to dashboard
      clearToken();
      clearSessionCookie();
      clearRoleCookie();
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    if (!roleOk || !permOk) {
      const target = redirectTo ?? homeRouteForRole(user.role);
      // NEVER replace if already at target — prevents infinite request loops
      if (pathname !== target) {
        router.replace(target);
      }
    }
  }, [isLoading, planResolving, user, roleOk, permOk, router, redirectTo, pathname]);

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
