import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  normalizeRole,
  type Permission,
  type Role,
} from "@/lib/auth/permissions";

export interface RoleGuardProps {
  permission?: Permission;
  permissions?: Permission[];
  roles?: Role[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGuard({
  permission,
  permissions,
  roles,
  requireAll = false,
  fallback = null,
  children,
}: RoleGuardProps) {
  const { user } = useAuth();
  const userRole = user?.role;

  if (roles && roles.length > 0) {
    const currentNorm = normalizeRole(userRole);
    if (!roles.map(normalizeRole).includes(currentNorm)) {
      return <>{fallback}</>;
    }
  }

  if (permission && !hasPermission(userRole, permission)) {
    return <>{fallback}</>;
  }

  if (permissions && permissions.length > 0) {
    const check = requireAll ? hasAllPermissions : hasAnyPermission;
    if (!check(userRole, permissions)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
