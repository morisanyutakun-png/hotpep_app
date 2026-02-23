"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface User {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
}

interface Membership {
  id: string;
  tenant_id: string;
  role: string;
  tenant_name: string | null;
}

interface AuthState {
  user: User | null;
  memberships: Membership[];
  token: string | null;
  tenantId: string | null;
  role: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setTenant: (tenantId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    memberships: [],
    token: null,
    tenantId: null,
    role: null,
    isLoading: true,
  });

  const fetchMe = useCallback(async (token: string) => {
    try {
      const data = await apiFetch<{ user: User; memberships: Membership[] }>("/auth/me", {
        token,
        tenantId: localStorage.getItem("tenantId") || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "",
      });
      const tenantId = localStorage.getItem("tenantId") || data.memberships[0]?.tenant_id || null;
      const role = data.memberships.find((m) => m.tenant_id === tenantId)?.role || null;

      if (tenantId) {
        localStorage.setItem("tenantId", tenantId);
      }

      setState({
        user: data.user,
        memberships: data.memberships,
        token,
        tenantId,
        role,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("tenantId");
      setState((prev) => ({ ...prev, token: null, user: null, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchMe(token);
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string; token_type: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    localStorage.setItem("token", data.access_token);
    await fetchMe(data.access_token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    setState({
      user: null,
      memberships: [],
      token: null,
      tenantId: null,
      role: null,
      isLoading: false,
    });
  };

  const setTenant = (tenantId: string) => {
    localStorage.setItem("tenantId", tenantId);
    const role = state.memberships.find((m) => m.tenant_id === tenantId)?.role || null;
    setState((prev) => ({ ...prev, tenantId, role }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setTenant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
