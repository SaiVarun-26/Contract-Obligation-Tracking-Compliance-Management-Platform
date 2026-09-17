import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearAccessToken,
  readAccessToken,
  setUnauthorizedHandler,
  storeAccessToken,
} from "@/lib/api/client";
import { loginRequest } from "./auth-api";
import { normalizeRole, type Role } from "./permissions";

export type AuthUser = { email: string; id?: number; role?: Role };

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  signIn: (input: { email: string; password: string; rememberMe: boolean }) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_KEY = "contractiq_user_email";

function userFromToken(token: string): AuthUser | null {
  try {
    const rawBase64 = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = rawBase64.padEnd(
      rawBase64.length + ((4 - (rawBase64.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(paddedBase64)) as {
      sub?: string;
      user_id?: number;
      role?: string;
      exp?: number;
    };
    if (!payload.sub || (payload.exp && payload.exp * 1000 <= Date.now())) return null;
    const role = payload.role ? normalizeRole(payload.role) : undefined;
    return {
      email: payload.sub,
      ...(payload.user_id !== undefined ? { id: payload.user_id } : {}),
      ...(role !== undefined ? { role } : {}),
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const signOut = useCallback(() => {
    clearAccessToken();
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_KEY);
    queryClient.clear();
    setToken(null);
    setUser(null);
  }, [queryClient]);

  useEffect(() => {
    const existing = readAccessToken();
    if (existing) {
      const restoredUser = userFromToken(existing);
      if (!restoredUser) {
        clearAccessToken();
      } else {
        setToken(existing);
        setUser(restoredUser);
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
      window.location.assign("/login?expired=1");
    });
    return () => setUnauthorizedHandler(() => undefined);
  }, [signOut]);

  // Proactive token expiration monitor
  useEffect(() => {
    if (!token) return;
    const checkTokenValidity = () => {
      const activeUser = userFromToken(token);
      if (!activeUser) {
        signOut();
        window.location.assign("/login?expired=1");
      }
    };

    const interval = setInterval(checkTokenValidity, 15000);
    window.addEventListener("focus", checkTokenValidity);
    document.addEventListener("visibilitychange", checkTokenValidity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkTokenValidity);
      document.removeEventListener("visibilitychange", checkTokenValidity);
    };
  }, [token, signOut]);

  const signIn = useCallback(
    async ({
      email,
      password,
      rememberMe,
    }: {
      email: string;
      password: string;
      rememberMe: boolean;
    }) => {
      const result = await loginRequest({ email, password });
      storeAccessToken(result.access_token, rememberMe);
      (rememberMe ? localStorage : sessionStorage).setItem(USER_KEY, email);
      setToken(result.access_token);
      setUser(userFromToken(result.access_token) ?? { email });
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, isAuthenticated: Boolean(token), isHydrated, signIn, signOut }),
    [token, user, isHydrated, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
