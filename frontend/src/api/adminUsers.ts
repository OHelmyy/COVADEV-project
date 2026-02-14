// src/api/adminUsers.ts
import { apiDelete, apiGet, apiPatch, apiPost } from "./http";
import type { Role } from "./auth";

export type AdminUser = {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt?: string | null;
};

export function adminListUsers() {
  return apiGet<{ users: AdminUser[] }>("/api/admin/users/");
}

export function adminCreateUser(input: {
  email: string;
  fullName: string;
  role: Role;
  password: string;
  isActive: boolean;
}) {
  return apiPost<{ user: AdminUser }>("/api/admin/users/", input);
}

export function adminUpdateUser(
  id: number,
  patch: Partial<{ email: string; fullName: string; role: Role; password: string; isActive: boolean }>
) {
  return apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/`, patch);
}

export function adminDeleteUser(id: number) {
  return apiDelete<{ ok: true }>(`/api/admin/users/${id}/`);
}