import { apiGet } from "./http";

export type AdminDashboardStats = {
  totalUsers: number;
  totalProjects: number;
  admins: number;
  evaluators: number;
  developers: number;
};

export function fetchAdminDashboard() {
  return apiGet<{ stats: AdminDashboardStats }>("/api/admin/dashboard/");
}