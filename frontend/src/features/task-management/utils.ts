export function getStatusLabel(status?: string | null): string {
  if (!status) return "UNASSIGNED";
  return status.replaceAll("_", " ");
}