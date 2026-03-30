import type { ReportPayload } from "../types/projectDetail";

export async function fetchProjectReport(
  projectId: number,
): Promise<ReportPayload> {
  const res = await fetch(`/api/projects/${projectId}/report/`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load report (${res.status})`);
  }

  return (await res.json()) as ReportPayload;
}
