import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { readAccessToken } from "@/lib/api/client";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password"];

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isHydrated } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isHydrated && !isAuthenticated && !isPublic) {
      navigate({ to: "/login", replace: true });
    }
  }, [isHydrated, isAuthenticated, isPublic, navigate]);

  // Handle browser back-forward cache (BFCache) when navigating Back after logout
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !isPublic) {
        const token = readAccessToken();
        if (!token) {
          window.location.replace("/login");
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [isPublic]);

  if (isPublic) return <>{children}</>;
  if (!isHydrated || !isAuthenticated) {
    return <div className="min-h-svh bg-background" aria-busy="true" />;
  }
  return <>{children}</>;
}

export function useIsPublicRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return PUBLIC_ROUTES.includes(pathname);
}
