// src/api/auth.ts
import { apiGet, apiPost } from "./http";

export type Role = "ADMIN" | "EVALUATOR" | "DEVELOPER";

export type MeResponse = {
  isAuthenticated: boolean;
  user: null | {
    id?: number;
    email: string;
    fullName?: string;
    role: Role;
  };
};

export function apiMe() {
  return apiGet<MeResponse>("/api/auth/me/");
}

export function apiLogin(username: string, password: string) {
  return apiPost<{ ok: true }>("/api/auth/login/", { username, password });
}

export function apiLogout() {
  return apiPost<{ ok: true }>("/api/auth/logout/", {});
}