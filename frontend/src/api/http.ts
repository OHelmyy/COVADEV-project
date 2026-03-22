import {
  apiGet,
  apiPostJson,
  apiPatchJson,
  apiDelete,
  apiUpload,
} from "../lib/api";

export { apiGet, apiUpload, apiDelete };

export function apiPost<T>(url: string, data: Record<string, any>) {
  return apiPostJson<T>(url, data);
}

export function apiPatch<T>(url: string, data: Record<string, any>) {
  return apiPatchJson<T>(url, data);
}