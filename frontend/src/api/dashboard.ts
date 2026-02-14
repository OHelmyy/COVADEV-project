// frontend/src/api/dashboard.ts
import { apiGet } from "./http";
import type { DashboardStats } from "./types";

export function fetchDashboardStats() {
  return apiGet<DashboardStats>("/api/reports/dashboard/");
}
