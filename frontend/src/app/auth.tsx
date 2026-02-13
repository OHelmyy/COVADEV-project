// src/app/auth.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type Role, apiLogin, apiLogout, apiMe } from "../api/auth";

export type AuthUser = {
  email: string;
  fullName?: string;
  role: Role;
};

type AuthCtx = {
  loading: boolean;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  async function refresh() {
    const me = await apiMe();
    setUser(me.user ? { email: me.user.email, fullName: me.user.fullName, role: me.user.role } : null);
  }

  async function login(username: string, password: string) {
    await apiLogin(username, password);
    await refresh();
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(() => ({ loading, user, refresh, login, logout }), [loading, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}