import type { TimeTrackingStatus } from "./types";

export function getStatusLabel(status?: string | null): string {
  if (!status) return "UNASSIGNED";
  return status.replaceAll("_", " ");
}

export function getTimeTrackingTone(status?: TimeTrackingStatus | null) {
  switch (status) {
    case "COMPLETED_EARLY":
      return {
        bg: "#ecfdf5",
        fg: "#047857",
        border: "#a7f3d0",
        label: "Finished early",
      };

    case "ON_TIME":
      return {
        bg: "#eff6ff",
        fg: "#1d4ed8",
        border: "#bfdbfe",
        label: "On time",
      };

    case "SLIGHTLY_OVER":
      return {
        bg: "#fffbeb",
        fg: "#b45309",
        border: "#fde68a",
        label: "Slightly over",
      };

    case "OVER_ESTIMATE":
      return {
        bg: "#fef2f2",
        fg: "#b91c1c",
        border: "#fecaca",
        label: "Over estimate",
      };

    case "IN_PROGRESS":
      return {
        bg: "#f5f3ff",
        fg: "#6d28d9",
        border: "#ddd6fe",
        label: "In progress",
      };

    case "NOT_STARTED":
      return {
        bg: "#f8fafc",
        fg: "#475569",
        border: "#e2e8f0",
        label: "Not started",
      };

    case "NO_ACTUAL_TIME":
      return {
        bg: "#f8fafc",
        fg: "#475569",
        border: "#e2e8f0",
        label: "No actual time",
      };

    case "NO_ESTIMATE":
    default:
      return {
        bg: "#f3f4f6",
        fg: "#4b5563",
        border: "#e5e7eb",
        label: "No estimate",
      };
  }
}