import { apiGet } from "./http";
import type { DashboardStats } from "./types";

// Helmy can implement this endpoint in Django
export function fetchDashboardStats() {
  return apiGet<DashboardStats>("/api/reports/dashboard/");
}
