"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission, UserRole } from "@/types/auth";
import { Skeleton } from "@/components/ui/Skeleton";

export function Protected({
  roles,
  permission,
  redirectTo = "/dashboard",
  children,
}: {
  roles?: UserRole[];
  permission?: Permission;
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const { user, isLoading, role } = useAuth();
  const { canAccess } = usePermissions();
  const router = useRouter();
  const roleOk = !roles || (role && roles.includes(role));
  const permOk = canAccess(permission);
  useEffect(() => {
    if (isLoading) return;
    if (!user || !roleOk) router.replace("/login");
    else if (!permOk) router.replace(redirectTo);
  }, [isLoading, user, roleOk, permOk, router, redirectTo]);
  if (isLoading || !user || !roleOk || !permOk) {
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
