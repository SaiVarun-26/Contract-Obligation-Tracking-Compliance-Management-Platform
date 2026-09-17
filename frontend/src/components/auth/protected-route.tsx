import { Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  hasPermission,
  hasAnyPermission,
  normalizeRole,
  type Permission,
  type Role,
} from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  permission?: Permission;
  permissions?: Permission[];
  roles?: Role[];
  children: ReactNode;
}

export function ProtectedRoute({
  permission,
  permissions,
  roles,
  children,
}: ProtectedRouteProps) {
  const { user } = useAuth();
  const userRole = user?.role;
  const normalized = normalizeRole(userRole);

  let isAllowed = true;

  if (roles && roles.length > 0) {
    if (!roles.map(normalizeRole).includes(normalized)) {
      isAllowed = false;
    }
  }

  if (isAllowed && permission) {
    if (!hasPermission(userRole, permission)) {
      isAllowed = false;
    }
  }

  if (isAllowed && permissions && permissions.length > 0) {
    if (!hasAnyPermission(userRole, permissions)) {
      isAllowed = false;
    }
  }

  if (!isAllowed) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
        <div className="mx-auto max-w-md space-y-4">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-8" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            403 - Access Denied
          </h1>
          <p className="text-sm text-muted-foreground">
            You are signed in as <span className="font-semibold text-foreground">{normalized}</span>, which does not have permission to access this resource.
          </p>
          <div className="pt-4">
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="mr-2 size-4" />
                Return to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
