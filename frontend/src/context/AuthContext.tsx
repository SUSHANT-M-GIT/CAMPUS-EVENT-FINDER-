import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { login as loginRequest, signup as signupRequest } from "../services/authService";
import type { AuthUser, UserRole } from "../types";

interface SignupInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  collegeName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  signup: (input: SignupInput) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as {
      user: AuthUser;
      exp: number;
    };
    if (!payload?.user?.id || !payload?.user?.role) return null;
    return payload.user;
  } catch {
    return null;
  }
}

function normalizeRole(role: string): AuthUser["role"] {
  return (role === "user" ? "student" : role) as AuthUser["role"];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );

  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as AuthUser;
        return { ...parsed, role: normalizeRole(parsed.role) };
      } catch {
        localStorage.removeItem("user");
      }
    }
    const storedToken = localStorage.getItem("token");
    return storedToken ? parseJwt(storedToken) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest({ email, password });
    const parsedUser = parseJwt(response.token);
    const normalizedUser = parsedUser
      ? ({ ...parsedUser, role: normalizeRole(parsedUser.role) } as AuthUser)
      : null;
    localStorage.setItem("token", response.token);
    if (normalizedUser) {
      localStorage.setItem("user", JSON.stringify(normalizedUser));
    }
    setToken(response.token);
    setUser(normalizedUser);
    return normalizedUser;
  }, []);

  const signup = useCallback(async ({ name, email, password, role, collegeName }: SignupInput) => {
    const response = await signupRequest({ name, email, password, role, collegeName });
    return response.msg;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      login,
      signup,
      logout,
    }),
    [user, token, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
