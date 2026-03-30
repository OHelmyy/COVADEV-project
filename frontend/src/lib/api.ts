import { getCookie } from "./csrf";

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("X-CSRFToken")) {
    headers.set("X-CSRFToken", getCookie("csrftoken") || "");
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}

export async function apiJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    const snippet = looksLikeHtml(text)
      ? "HTML response (likely login/404/CSRF)"
      : text.slice(0, 200);

    throw new Error(`HTTP ${response.status}: ${snippet}`);
  }

  if (!text) {
    return null as T;
  }

  if (looksLikeHtml(text)) {
    throw new Error("Expected JSON but got HTML (check endpoint URL / login / permissions).");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
  }
}

export function apiGet<T = any>(url: string) {
  return apiJson<T>(url, { method: "GET" });
}

export function apiPostJson<T = any>(url: string, data: unknown) {
  return apiJson<T>(url, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function apiPatchJson<T = any>(url: string, data: unknown) {
  return apiJson<T>(url, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function apiDelete<T = any>(url: string) {
  return apiJson<T>(url, {
    method: "DELETE",
  });
}

export function apiUpload<T = any>(url: string, form: FormData) {
  return apiJson<T>(url, {
    method: "POST",
    body: form,
  });
}