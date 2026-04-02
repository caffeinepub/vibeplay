import { useCallback, useEffect, useRef, useState } from "react";
import type { backendInterface as FullBackendInterface } from "../backend.d";
import { useActor } from "./useActor";

const SESSION_TOKEN_KEY = "vibeplay_session_token";

export interface AuthUser {
  id: bigint;
  email: string;
  username: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useAuth() {
  const { actor, isFetching } = useActor();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  // Restore session on mount
  useEffect(() => {
    if (isFetching || initializedRef.current) return;
    initializedRef.current = true;

    const storedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!storedToken || !actor) {
      setIsLoading(false);
      return;
    }

    const backend = actor as unknown as FullBackendInterface;
    backend
      .getMe(storedToken)
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          setSessionToken(storedToken);
        } else {
          localStorage.removeItem(SESSION_TOKEN_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(SESSION_TOKEN_KEY);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [actor, isFetching]);

  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!actor) return { success: false, error: "Not connected" };
      try {
        const passwordHash = await hashPassword(password);
        const backend = actor as unknown as FullBackendInterface;
        const result = await backend.login(email, passwordHash);
        if ("ok" in result) {
          const token = result.ok;
          localStorage.setItem(SESSION_TOKEN_KEY, token);
          setSessionToken(token);
          const user = await backend.getMe(token);
          if (user) setCurrentUser(user);
          return { success: true };
        }
        return { success: false, error: result.err };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
    [actor],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!actor) return { success: false, error: "Not connected" };
      try {
        const passwordHash = await hashPassword(password);
        const backend = actor as unknown as FullBackendInterface;
        const result = await backend.register(email, passwordHash);
        if ("ok" in result) {
          const token = result.ok;
          localStorage.setItem(SESSION_TOKEN_KEY, token);
          setSessionToken(token);
          const user = await backend.getMe(token);
          if (user) setCurrentUser(user);
          return { success: true };
        }
        return { success: false, error: result.err };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
    [actor],
  );

  const logout = useCallback(async () => {
    if (!actor || !sessionToken) return;
    try {
      const backend = actor as unknown as FullBackendInterface;
      await backend.logout(sessionToken);
    } catch {
      // ignore logout errors
    }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setSessionToken(null);
    setCurrentUser(null);
  }, [actor, sessionToken]);

  return {
    currentUser,
    sessionToken,
    isLoggedIn: !!currentUser,
    isLoading,
    login,
    register,
    logout,
  };
}
