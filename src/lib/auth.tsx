"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch } from "./api";
import type { Session, User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  idleWarning: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    full_name: string;
    department?: string | null;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  stayActive: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Renew this long before the access token lapses, so a slow network or a
// sleeping tab does not produce a 401 mid-session.
const REFRESH_MARGIN_MS = 60_000;
// How long before the idle cut-off we surface the warning.
const IDLE_WARNING_MS = 60_000;

/**
 * Whether the non-httpOnly session hint cookie is present.
 *
 * Only a hint — the API is still the authority on whether the session is real.
 */
function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((entry) => entry.trim().startsWith("rc_session="));
}

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "visibilitychange",
] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);

  const idleTimeoutMinutes = useRef(30);
  // Seeded on mount rather than at render time: Date.now() during render is an
  // impure read, and useRef would evaluate it on every render anyway.
  const lastActivity = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // applySession schedules the next token renewal, but silentRefresh is
  // defined below it and itself depends on applySession. Routing the call
  // through a ref breaks that cycle without relying on hoisting.
  const silentRefreshRef = useRef<() => void>(() => {});

  const applySession = useCallback((session: Session) => {
    setUser(session.user);
    idleTimeoutMinutes.current = session.idle_timeout_minutes;

    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = Math.max(
      15_000,
      session.access_token_expires_in * 1000 - REFRESH_MARGIN_MS,
    );
    refreshTimer.current = setTimeout(() => {
      silentRefreshRef.current();
    }, delay);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setIdleWarning(false);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const session = await apiFetch<Session>("/auth/refresh", { method: "POST" });
      applySession(session);
    } catch {
      clearSession();
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    silentRefreshRef.current = () => void silentRefresh();
  }, [silentRefresh]);

  const loadSession = useCallback(async () => {
    // Skip the round trip entirely when the browser holds no session hint.
    // The provider wraps the marketing pages too, and without this every
    // anonymous visitor would fire a guaranteed-401 /auth/me on page load.
    if (!hasSessionHint()) {
      clearSession();
      setLoading(false);
      return;
    }

    try {
      const session = await apiFetch<Session>("/auth/me");
      applySession(session);
    } catch (error) {
      // A 401 here usually means the access token lapsed while the tab was
      // closed. The refresh token may still be good, so try once before
      // treating the user as signed out.
      if (error instanceof ApiError && error.status === 401) {
        try {
          const session = await apiFetch<Session>("/auth/refresh", {
            method: "POST",
          });
          applySession(session);
          return;
        } catch {
          /* genuinely signed out */
        }
      }
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    void loadSession();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (idleTimer.current) clearInterval(idleTimer.current);
    };
  }, [loadSession]);

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch {
      /* the cookies are cleared regardless; nothing useful to surface here */
    }
    clearSession();
    router.push("/login");
    router.refresh();
  }, [clearSession, router]);

  // --- inactivity auto-logout ---------------------------------------------
  // The brief calls for this explicitly: the platform holds sensitive employee
  // data, so an unattended session should not stay open indefinitely.
  useEffect(() => {
    if (!user) return;

    // Seed the clock here rather than at render time.
    if (lastActivity.current === 0) lastActivity.current = Date.now();

    const markActive = () => {
      if (document.visibilityState === "hidden") return;
      lastActivity.current = Date.now();
      setIdleWarning(false);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    idleTimer.current = setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      const limitMs = idleTimeoutMinutes.current * 60_000;

      if (idleMs >= limitMs) {
        void logout();
      } else if (idleMs >= limitMs - IDLE_WARNING_MS) {
        setIdleWarning(true);
      }
    }, 10_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      if (idleTimer.current) clearInterval(idleTimer.current);
    };
  }, [user, logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await apiFetch<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      lastActivity.current = Date.now();
      applySession(session);
      setLoading(false);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      full_name: string;
      department?: string | null;
    }) => {
      const session = await apiFetch<Session>("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      lastActivity.current = Date.now();
      applySession(session);
      setLoading(false);
    },
    [applySession],
  );

  const stayActive = useCallback(() => {
    lastActivity.current = Date.now();
    setIdleWarning(false);
    void silentRefresh();
  }, [silentRefresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      idleWarning,
      login,
      register,
      logout,
      refresh: silentRefresh,
      stayActive,
    }),
    [user, loading, idleWarning, login, register, logout, silentRefresh, stayActive],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }
  return context;
}
